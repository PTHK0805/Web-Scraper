import React, { FormEvent } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface UrlInputFormProps {
    url: string;
    setUrl: (url: string) => void;
    onSubmit: (event?: FormEvent<HTMLFormElement>) => void;
    isLoading: boolean;
}

export function UrlInputForm({ url, setUrl, onSubmit, isLoading }: UrlInputFormProps) {
    return (
        <Card className="mb-6 bg-muted/30 dark:bg-gray-800/30 shadow-sm">
            <CardContent className="p-4 md:p-6">
                <form onSubmit={onSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <Label htmlFor="urlInput" className="font-medium">Website URL</Label>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Input
                                id="urlInput"
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="e.g., example.com or https://example.com"
                                required
                                disabled={isLoading}
                                className="flex-grow dark:bg-gray-700 dark:border-gray-600 focus-visible:ring-primary/50"
                            />
                            <Button type="submit" disabled={isLoading || !url} className="w-full sm:w-auto">
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isLoading ? 'Extracting...' : 'Extract Media'}
                            </Button>
                        </div>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}