import React from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter, X } from "lucide-react";
import type { MediaItem } from '@/app/api/scrape/route'; // Adjust path if needed

type MediaType = MediaItem['type'];

interface FilterControlsProps {
    showFilters: boolean;
    onToggleShowFilters: () => void;
    selectedTypes: Record<MediaType, boolean>;
    onTypeToggle: (type: MediaType) => void;
    availableExtensions: string[];
    selectedExtensions: string[];
    onExtensionToggle: (extension: string) => void;
    onSelectAllExtensions: () => void;
    onDeselectAllExtensions: () => void;
}

export function FilterControls({
                                   showFilters,
                                   onToggleShowFilters,
                                   selectedTypes,
                                   onTypeToggle,
                                   availableExtensions,
                                   selectedExtensions,
                                   onExtensionToggle,
                                   onSelectAllExtensions,
                                   onDeselectAllExtensions
                               }: FilterControlsProps) {
    // Determine which media types are available based on fetched data (optional, but good practice)
    // const availableTypes = ['image', 'video'].filter(type =>
    //     allMedia.some(item => item.type === type)
    // ) as MediaType[];
    // For now, assume both image/video are always possible filter options

    return (
        <Card className="mb-6 bg-muted/30 dark:bg-gray-800/30 shadow-sm">
            <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-lg flex justify-between items-center font-semibold">
                    Filters
                    <Button variant="ghost" size="sm" onClick={onToggleShowFilters}>
                        {showFilters ? <X className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
                    </Button>
                </CardTitle>
            </CardHeader>
            {showFilters && (
                <CardContent className="space-y-4 pt-2 pb-4">
                    {/* Type Filters */}
                    <div>
                        <Label className="font-medium block mb-2">Media Type</Label>
                        <div className="flex gap-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox id="type-image" checked={selectedTypes.image} onCheckedChange={() => onTypeToggle('image')} />
                                <Label htmlFor="type-image" className="cursor-pointer font-normal">Images</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="type-video" checked={selectedTypes.video} onCheckedChange={() => onTypeToggle('video')} />
                                <Label htmlFor="type-video" className="cursor-pointer font-normal">Videos</Label>
                            </div>
                        </div>
                    </div>
                    {/* Extension Filters */}
                    {availableExtensions.length > 0 && (
                        <div>
                            <Label className="font-medium block mb-2">File Extension</Label>
                            <div className="flex gap-2 mb-2 flex-wrap">
                                <Button variant="outline" size="sm" onClick={onSelectAllExtensions}>Select All ({availableExtensions.length})</Button>
                                <Button variant="outline" size="sm" onClick={onDeselectAllExtensions} disabled={selectedExtensions.length === 0}>Deselect All</Button>
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-4 gap-y-2 max-h-36 overflow-y-auto p-2 border rounded-md dark:border-gray-700">
                                {availableExtensions.map(ext => (
                                    <div key={ext} className="flex items-center space-x-2">
                                        <Checkbox id={`ext-${ext}`} checked={selectedExtensions.includes(ext)} onCheckedChange={() => onExtensionToggle(ext)} />
                                        <Label htmlFor={`ext-${ext}`} className="text-sm cursor-pointer font-normal">{ext.toUpperCase()}</Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
}