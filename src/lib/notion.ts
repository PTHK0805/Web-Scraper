// src/lib/notion.ts
import { Client } from "@notionhq/client";
import { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints"; // Import specific type

// --- Notion Client Initialization ---
const notionApiKey = process.env.NOTION_API_KEY;
const databaseId = process.env.NOTION_DATABASE_ID; // Renamed for clarity within this module

let notion: Client | null = null;

if (notionApiKey && databaseId) {
    try {
        notion = new Client({ auth: notionApiKey });
        console.info("Notion client initialized successfully.");
    } catch (error) {
        console.error("Failed to initialize Notion client:", error);
        notion = null; // Ensure notion is null if initialization fails
    }
} else {
    console.warn("Notion API Key or Database ID not found in environment variables. Notion logging disabled.");
}

// --- Define the structure for logging data ---
export interface NotionScrapeLogData {
    url: string;
    status: 'Success' | 'Failure';
    itemsFound?: number;
    errorMessage?: string;
}

// --- Exportable Logging Function ---
/**
 * Logs a scrape event attempt to the configured Notion database.
 * Silently skips if Notion client isn't initialized or database ID is missing.
 * Logs Notion API errors to the server console.
 *
 * @param data - The data for the log entry.
 */
export async function logScrapeEvent(data: NotionScrapeLogData): Promise<void> {
    // Check if Notion client and database ID are available
    if (!notion || !databaseId) {
        // console.log("Skipping Notion log: Client not initialized or Database ID missing.");
        return; // Exit silently if not configured
    }

    console.log(`Attempting to log scrape event to Notion: Status - ${data.status}, URL - ${data.url}`);

    try {
        // Construct the properties object for the Notion page
        // IMPORTANT: Keys ('URL Scraped', 'Timestamp', etc.) MUST match your Notion DB column names exactly!
        const properties: CreatePageParameters["properties"] = {
            // Assuming 'URL Scraped' is your Title property
            'URL Scraped': {
                title: [
                    {
                        text: {
                            // Limit title length if Notion has constraints or for readability
                            content: data.url.substring(0, 250),
                        },
                    },
                ],
            },

            'Timestamp': {
                date: {
                    start: new Date().toISOString(), // Use current time
                },
            },
            'Status': {
                select: {
                    name: data.status, // Ensure 'Success' and 'Failure' exist as options in Notion
                },
            },
        };

        // Conditionally add 'Items Found' if it's a valid number
        if (data.itemsFound !== undefined && data.itemsFound >= 0) {
            properties['Items Found'] = { // Use bracket notation for names with spaces
                number: data.itemsFound,
            };
        }

        // Conditionally add 'Error Message' if it exists
        if (data.errorMessage) {
            properties['Error Message'] = { // Use bracket notation
                // Notion's rich_text expects an array of text objects
                rich_text: [
                    {
                        text: {
                            // Truncate message to avoid Notion API limits (usually 2000 characters per block)
                            content: data.errorMessage.substring(0, 2000),
                        },
                    },
                ],
            };
        }

        // Create the page in Notion
        await notion.pages.create({
            parent: { database_id: databaseId },
            properties: properties,
        });

        console.log("Successfully logged scrape event to Notion.");

    } catch (error: any) {
        // Log Notion-specific errors to the server console ONLY
        // Avoid crashing the main API route due to logging issues
        console.error("Failed to log scrape event to Notion:", error.body || error.message || error);
    }
}