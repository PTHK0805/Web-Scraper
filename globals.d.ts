import { PushSubscription } from 'web-push';

declare global {
    var subscriptions: PushSubscription[] | undefined;
}