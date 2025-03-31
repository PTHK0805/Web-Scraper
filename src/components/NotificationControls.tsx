import React from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, BellPlus, BellOff, Send } from 'lucide-react'; // Import necessary icons

interface NotificationControlsProps {
    isSupported: boolean;
    subscription: PushSubscription | null;
    onSubscribe: () => void;
    onUnsubscribe: () => void;
    onSendTest: () => void;
    isSubscribing: boolean;
    isUnsubscribing: boolean;
}

export function NotificationControls({
                                         isSupported,
                                         subscription,
                                         onSubscribe,
                                         onUnsubscribe,
                                         onSendTest,
                                         isSubscribing,
                                         isUnsubscribing
                                     }: NotificationControlsProps) {
    if (!isSupported) {
        return <p className="text-sm text-amber-600 dark:text-amber-400">Push Notifications not supported or enabled in this browser.</p>;
    }

    const isSubscribeActionLoading = isSubscribing;
    const isUnsubscribeActionLoading = isUnsubscribing;
    const isAnyActionLoading = isSubscribeActionLoading || isUnsubscribeActionLoading;

    return (
        <div className="flex flex-wrap gap-2 items-center mb-4">
            {subscription ? (
                // --- Unsubscribe Button ---
                <Button
                    variant="destructive" // Use destructive variant
                    onClick={onUnsubscribe}
                    disabled={isAnyActionLoading}
                    aria-label="Unsubscribe from notifications"
                >
                    {isUnsubscribeActionLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <BellOff className="mr-2 h-4 w-4" /> // BellOff icon
                    )}
                    {isUnsubscribeActionLoading ? 'Unsubscribing...' : 'Unsubscribe'}
                </Button>
            ) : (
                // --- Subscribe Button ---
                <Button
                    variant="default" // Use default primary variant
                    onClick={onSubscribe}
                    disabled={isAnyActionLoading}
                    aria-label="Subscribe to notifications"
                >
                    {isSubscribeActionLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <BellPlus className="mr-2 h-4 w-4" /> // BellPlus icon
                    )}
                    {isSubscribeActionLoading ? 'Subscribing...' : 'Subscribe Notifications'}
                </Button>
            )}

            {/* --- Send Test Notification Button --- */}
            {/*{subscription && (*/}
            {/*    <Button*/}
            {/*        variant="outline" // Keep outline for secondary action*/}
            {/*        onClick={onSendTest}*/}
            {/*        disabled={isAnyActionLoading} // Disable if any other action is in progress*/}
            {/*        aria-label="Send a test notification"*/}
            {/*    >*/}
            {/*        <Send className="mr-2 h-4 w-4" /> /!* Send icon *!/*/}
            {/*        Send Test*/}
            {/*    </Button>*/}
            {/*)}*/}
        </div>
    );
}