import React from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, Bell, BellOff, Send } from 'lucide-react'; // Import necessary icons

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
        <div className="fixed top-4 left-4 z-50">
            {subscription ? (
                // --- Unsubscribe Button ---
                <Button
                    className="mr-2"
                    variant="default" // Use destructive variant
                    onClick={onUnsubscribe}
                    disabled={isAnyActionLoading}
                    aria-label=""
                >
                    {isUnsubscribeActionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Bell className="h-4 w-4" />
                    )}
                    {/*{isUnsubscribeActionLoading ? 'Unsubscribing...' : 'Unsubscribe'}*/}
                </Button>
            ) : (
                // --- Subscribe Button ---
                <Button
                    className="dark:bg-red-600 text-white"
                    onClick={onSubscribe}
                    disabled={isAnyActionLoading}
                    aria-label=""
                >
                    {isSubscribeActionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <BellOff className="h-4 w-4" />
                    )}
                    {/*{isSubscribeActionLoading ? 'Subscribing...' : 'Subscribe Notifications'}*/}
                </Button>
            )}

             {/*--- Send Test Notification Button ---*/}
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