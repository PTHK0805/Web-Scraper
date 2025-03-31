import React from 'react';
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button"; // Adjust path as necessary

interface InstallPromptDisplayProps {
    isIOS: boolean;
    isStandalone: boolean;
    onInstallClick?: () => void; // Optional: Add logic for non-iOS install prompt
}

export function InstallPromptDisplay({ isIOS, isStandalone, onInstallClick }: InstallPromptDisplayProps) {
    // Don't show if already installed (standalone) or if not on iOS (for this specific prompt)
    // You might need more sophisticated logic for Android/Desktop PWAs using beforeinstallprompt
    if (isStandalone) {
        return null;
    }

    // Basic prompt for adding to homescreen
    // Note: Real PWA install prompts often rely on the 'beforeinstallprompt' event,
    // which is not handled in this basic version. This mainly provides iOS guidance.

    return (
        <Card className="mb-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-base font-semibold text-blue-800 dark:text-blue-200">Install App</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-blue-700 dark:text-blue-300 pb-3">
                <Button onClick={onInstallClick} size="sm" disabled={isIOS}>
                     Add to Home Screen
                </Button>
                {/* The button above is commented out as standard install flow isn't implemented */}
                {/* Focus on iOS instructions */}
                {isIOS ? (
                    <p className="mt-2">
                        To install this app on your iOS device, tap the share button
                        <span role="img" aria-label="share icon" className="mx-1 inline-block text-lg">􀈂</span> {/* Use SF Symbol or similar icon if possible */}
                        (Share) and then select {`"Add to Home Screen"`}
                        <span role="img" aria-label="plus icon" className="ml-1 inline-block text-lg">􀅼</span> {/* Use SF Symbol or similar icon if possible */}
                        .
                    </p>
                ) : (
                    <p className="mt-2">Consider adding this page to your bookmarks or home screen for quick access.</p> // Generic message for non-iOS
                )}
            </CardContent>
        </Card>
    );
}