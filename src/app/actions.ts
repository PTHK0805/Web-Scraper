// src/app/actions.ts
'use server';

import webpush, { PushSubscription } from 'web-push'; // Import PushSubscription type

// --- Database Interaction Placeholders ---
// Replace these with your actual database client and logic (e.g., Prisma, Drizzle, MongoDB)
import { db } from '@/lib/db'; // Assuming you have a db instance configured

async function dbSaveSubscription(sub: PushSubscription): Promise<void> {
    console.log('DB Placeholder: Saving subscription for endpoint:', sub.endpoint);
    // Example using Prisma (adapt table/field names):
    // await db.pushSubscription.create({
    //   data: {
    //     endpoint: sub.endpoint,
    //     p256dh: sub.keys.p256dh,
    //     auth: sub.keys.auth,
    //     // Optionally link to a userId if you have user accounts
    //     // userId: getUserIdFromSession(),
    //   },
    // });

    // --- OR Simple JSON storage (Not recommended for production scale) ---
    // This example uses a simple in-memory store for demonstration,
    // REPLACE with a real database.
    if (!global.subscriptions) {
        global.subscriptions = [];
    }
    // Avoid duplicates based on endpoint
    if (!global.subscriptions.some((s: PushSubscription) => s.endpoint === sub.endpoint)) {
        global.subscriptions.push(sub);
        console.log('In-memory store: Added subscription. Count:', global.subscriptions.length);
    } else {
        console.log('In-memory store: Subscription already exists.');
    }


}

async function dbGetAllSubscriptions(): Promise<PushSubscription[]> {
    console.log('DB Placeholder: Getting all subscriptions');
    // Example using Prisma:
    // const records = await db.pushSubscription.findMany();
    // return records.map(rec => ({
    //   endpoint: rec.endpoint,
    //   keys: { p256dh: rec.p256dh, auth: rec.auth },
    // }));

    // --- OR Simple JSON storage ---
    if (!global.subscriptions) {
        global.subscriptions = [];
    }
    console.log('In-memory store: Retrieved subscriptions. Count:', global.subscriptions.length);
    return [...global.subscriptions]; // Return a copy
}

// It's better to unsubscribe based on the unique endpoint
async function dbDeleteSubscription(endpoint: string): Promise<void> {
    console.log('DB Placeholder: Deleting subscription for endpoint:', endpoint);
    // Example using Prisma:
    // await db.pushSubscription.deleteMany({
    //   where: { endpoint: endpoint },
    // });

    // --- OR Simple JSON storage ---
    if (global.subscriptions) {
        const initialLength = global.subscriptions.length;
        global.subscriptions = global.subscriptions.filter((s: PushSubscription) => s.endpoint !== endpoint);
        if (global.subscriptions.length < initialLength) {
            console.log('In-memory store: Removed subscription. New count:', global.subscriptions.length);
        } else {
            console.log('In-memory store: Subscription not found for removal.');
        }
    }
}
// Helper to remove invalid subscription after sending fails
async function dbRemoveSubscriptionByEndpoint(endpoint: string): Promise<void> {
    await dbDeleteSubscription(endpoint); // Reuse the delete logic
}


// --- WebPush Setup ---
// Ensure environment variables are set correctly
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
    console.error("VAPID keys are not configured. Check environment variables.");
    // Optionally throw an error to prevent startup if keys are missing
    // throw new Error("VAPID keys must be set in environment variables.");
} else {
    webpush.setVapidDetails(
        'mailto:your-email@example.com', // Replace with your actual contact email
        vapidPublicKey,
        vapidPrivateKey
    );
    console.log("WebPush VAPID details set.");
}


// --- Server Actions ---

/**
 * Stores the user's push subscription persistently.
 * @param sub - The PushSubscription object from the client.
 */
export async function subscribeUser(sub: PushSubscription | null) {
    // Validate the subscription object
    if (!sub || !sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
        console.error('Invalid subscription object received:', sub);
        return { success: false, error: 'Invalid subscription object provided.' };
    }

    try {
        await dbSaveSubscription(sub);
        console.log('Subscription saved for endpoint:', sub.endpoint);
        return { success: true };
    } catch (error) {
        console.error('Error saving subscription:', error);
        return { success: false, error: 'Failed to save subscription.' };
    }
}

/**
 * Removes the user's push subscription based on its endpoint.
 * @param endpoint - The unique endpoint URL of the subscription to remove.
 */
export async function unsubscribeUser(endpoint: string | null) {
    if (!endpoint) {
        console.error('Unsubscribe attempt with no endpoint.');
        return { success: false, error: 'Subscription endpoint required for unsubscribe.' };
    }
    try {
        await dbDeleteSubscription(endpoint);
        console.log('Subscription removed for endpoint:', endpoint);
        return { success: true };
    } catch (error) {
        console.error('Error removing subscription:', error);
        return { success: false, error: 'Failed to remove subscription.' };
    }
}

/**
 * Sends a notification to ALL currently stored subscriptions.
 * Modify this function if you need to target specific users.
 * @param title - The notification title.
 * @param message - The notification body/message.
 */
export async function sendNotification(title: string, message: string) {
    // Check if VAPID keys are set before attempting to send
    if (!vapidPublicKey || !vapidPrivateKey) {
        console.error("Cannot send notification: VAPID keys are not configured.");
        return { success: false, error: "Server VAPID keys not configured." };
    }

    let subscriptions: PushSubscription[] = [];
    try {
        subscriptions = await dbGetAllSubscriptions();
    } catch (error) {
        console.error('Error retrieving subscriptions from DB:', error);
        return { success: false, error: 'Failed to retrieve subscriptions.' };
    }


    if (subscriptions.length === 0) {
        console.log('No subscriptions found to send notifications to.');
        return { success: false, error: 'No active subscriptions found.' };
    }

    console.log(`Attempting to send notification to ${subscriptions.length} subscription(s)...`);

    const payload = JSON.stringify({
        title: title,
        message: message, // Match the key used in sw.js ('message')
        icon: '/icons/icon-192x192.png', // Match path in sw.js
        // You can add more data here to be used in sw.js notificationclick
        // data: { url: '/some-target-path' }
    });

    const sendPromises = subscriptions.map(sub =>
        webpush.sendNotification(sub, payload)
            .then(response => ({ endpoint: sub.endpoint, status: 'success', response }))
            .catch(error => {
                console.error(`Failed to send to ${sub.endpoint}:`, error.statusCode, error.body);
                // Handle specific errors, e.g., '410 Gone' means subscription expired/invalid
                if (error.statusCode === 410 || error.statusCode === 404) {
                    console.log(`Subscription ${sub.endpoint} is invalid (Gone/Not Found). Removing.`);
                    // Don't wait for this, just fire and forget removal
                    dbRemoveSubscriptionByEndpoint(sub.endpoint).catch(removeErr => {
                        console.error(`Failed to remove invalid subscription ${sub.endpoint}:`, removeErr);
                    });
                }
                // Return error status for aggregation
                return { endpoint: sub.endpoint, status: 'failed', error };
            })
    );

    try {
        const results = await Promise.allSettled(sendPromises); // Use allSettled to wait for all, even failures

        const successes = results.filter(r => r.status === 'fulfilled' && r.value.status === 'success').length;
        const failures = results.length - successes;

        console.log(`Notification send results: ${successes} successful, ${failures} failed.`);

        if (successes > 0 && failures === 0) {
            return { success: true, message: `Sent notification to ${successes} subscriber(s).` };
        } else if (successes > 0 && failures > 0) {
            return { success: true, message: `Sent notification to ${successes} subscriber(s), ${failures} failed.` };
        } else {
            return { success: false, error: `Failed to send notification to all ${failures} subscriber(s). Check logs.` };
        }

    } catch (error) {
        // This catch is less likely with Promise.allSettled but good practice
        console.error('Unexpected error during notification sending process:', error);
        return { success: false, error: 'An unexpected error occurred while sending notifications.' };
    }
}