import { useState, useEffect, useCallback } from 'react';
import { urlBase64ToUint8Array } from '@/lib/utils';
import { subscribeUser, unsubscribeUser, sendNotification } from '@/app/actions';
import { toast } from "sonner";

export function usePushNotifications() {
    const [isSupported, setIsSupported] = useState(false);
    const [subscription, setSubscription] = useState<PushSubscription | null>(null);
    const [isSubscribing, setIsSubscribing] = useState(false);
    const [isUnsubscribing, setIsUnsubscribing] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | null>(null);

    useEffect(() => {
        setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream);
        setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);

        if ('serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true);
            setPermissionStatus(Notification.permission);

            const registerAndCheckSubscription = async () => {
                try {
                    const registration = await navigator.serviceWorker.register('/sw.js', {
                        scope: '/',
                        updateViaCache: 'none',
                    });
                    const sub = await registration.pushManager.getSubscription();
                    setSubscription(sub);
                    const serializedSub = JSON.parse(JSON.stringify(sub));
                    await subscribeUser(serializedSub);
                } catch (error) {
                    console.error("Service Worker registration failed:", error);
                    setIsSupported(false); // Mark as unsupported if registration fails
                }
            };
            registerAndCheckSubscription();
        } else {
            setIsSupported(false);
        }
    }, []);

    const subscribe = useCallback(async () => {
        if (!isSupported || isSubscribing || subscription) return;

        try {
            setIsSubscribing(true);
            const registration = await navigator.serviceWorker.ready;
            const currentPermission = Notification.permission;
            setPermissionStatus(currentPermission);

            if (currentPermission === 'denied') {
                console.warn("Push notification permission denied.");
                toast.error("Permission Denied", { description: "Please enable notifications in your browser settings." });
                return;
            }
            // Request permission if not granted (will prompt user)
            // Note: Some browsers require user interaction to request permission.
             if (currentPermission === 'default') {
                 const requestedPermission = await Notification.requestPermission();
                 setPermissionStatus(requestedPermission);
                 if (requestedPermission !== 'granted') {
                     console.warn("Push notification permission not granted.");
                     toast.warning("Permission Not Granted", { description: "Notifications cannot be enabled without permission." });
                     return;
                 }
             }


            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(
                    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
                ),
            });
            setSubscription(sub);
            console.log("Sub in subscribe : ", sub)
            // Use structuredClone for potentially better serialization if needed, else JSON parse/stringify is fine
            const serializedSub = JSON.parse(JSON.stringify(sub));
            await subscribeUser(serializedSub); // Call server action
            console.log("Successfully subscribed to push notifications.");
            toast.success("Subscribed!", { description: "You will now receive notifications." });
        } catch (error: any) {
            console.error("Failed to subscribe to push notifications:", error);
            if (error.name === 'NotAllowedError' || permissionStatus === 'denied') {
                toast.error("Permission Denied", { description: "Notification permission was denied. Please check browser settings." });
            } else {
                toast.error("Subscription Failed", { description: "Could not subscribe to notifications." });
            }
            setSubscription(null); // Ensure subscription state is null on failure
        } finally {
            setIsSubscribing(false);
        }
    }, [isSupported, isSubscribing, subscription, permissionStatus]);

    const unsubscribe = useCallback(async () => {
        if (!subscription || isUnsubscribing) return;

        try {
            setIsUnsubscribing(true);
            await subscription.unsubscribe();
            await unsubscribeUser(); // Call server action
            setSubscription(null);
            console.log("Successfully unsubscribed from push notifications.");
            toast.success("Unsubscribed", { description: "You will no longer receive notifications." });
        } catch (error) {
            console.error("Failed to unsubscribe from push notifications:", error);
            toast.error("Unsubscription Failed", { description: "Could not unsubscribe." });
        } finally {
            setIsUnsubscribing(false);
        }
    }, [subscription, isUnsubscribing]);

    const sendTestNotification = useCallback(async (title: string, message: string) => {
        if (subscription) {
            try {
                await sendNotification(title, message); // Call server action
                toast.info("Test Notification Sent");
            } catch (error) {
                console.error("Failed to send test notification:", error);
                toast.error("Notification Failed", { description: "Could not send test notification." });
            }
        } else {
            toast.warning("Not Subscribed", { description: "Cannot send notification without subscription." });
        }
    }, [subscription]);

    return {
        isSupported,
        subscription,
        subscribe,
        unsubscribe,
        sendTestNotification,
        isSubscribing,
        isUnsubscribing,
        isIOS,
        isStandalone,
        permissionStatus,
    };
}