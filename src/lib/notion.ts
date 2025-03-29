// src/lib/notion.ts
import { Client } from "@notionhq/client";
import { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints"; // Import specific type

// --- Notion Client Initialization ---
const notionApiKey = process.env.NOTION_API_KEY;
const databaseId = process.env.NOTION_DATABASE_ID;

let notion: Client | null = null;

if (notionApiKey && databaseId) {
    try {
        notion = new Client({ auth: notionApiKey });
        console.info("Notion client initialized successfully.");
    } catch (error) {
        console.error("Failed to initialize Notion client:", error);
        notion = null;
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
    // Method is optional, but expected values are now 'Selenium' or 'Fetch' if provided
    method?: 'Selenium' | 'Fetch' | string; // Allow string for flexibility but document expected values
    statusCode?: number; // Optional status code for errors
}

// --- Exportable Logging Function ---
/**
 * Logs a scrape event attempt to the configured Notion database.
 * Silently skips if Notion client isn't initialized or database ID is missing.
 * Logs Notion API errors to the server console.
 *
 * @param data - The data for the log entry. Requires URL and Status.
 */
export async function logScrapeEvent(data: NotionScrapeLogData): Promise<void> {
    if (!notion || !databaseId) {
        // console.log("Skipping Notion log: Client not initialized or Database ID missing.");
        return;
    }

    // Log attempt locally for server visibility
    console.log(`Attempting to log to Notion: ${data.status} | Method: ${data.method || 'N/A'} | URL: ${data.url}`);

    try {
        // Construct the properties object for the Notion page
        // IMPORTANT: Keys ('URL Scraped', etc.) MUST match your Notion DB column names EXACTLY!
        const properties: CreatePageParameters["properties"] = {
            // Example: Assuming 'URL Scraped' is your Title property
            'URL Scraped': {
                title: [
                    { text: { content: data.url.substring(0, 250) } }, // Limit length
                ],
            },
            'Timestamp': { // Assuming 'Timestamp' is a Date property
                date: {
                    start: new Date().toISOString(),
                },
            },
            'Status': { // Assuming 'Status' is a Select property
                select: {
                    name: data.status, // Ensure 'Success' and 'Failure' options exist in Notion
                },
            },
        };

        // Conditionally add 'Items Found' (assuming Number property)
        if (data.itemsFound !== undefined && data.itemsFound >= 0) {
            properties['Items Found'] = { number: data.itemsFound };
        }

        // Conditionally add 'Error Message' (assuming Text or Rich Text property)
        if (data.errorMessage) {
            properties['Error Message'] = {
                rich_text: [
                    { text: { content: data.errorMessage.substring(0, 2000) } }, // Truncate
                ],
            };
        }

        // Conditionally add 'Method' (assuming Select or Text property)
        if (data.method) {
            // Adjust based on your Notion column type:
            // If 'Method' is a SELECT property:
            properties['Method'] = { select: { name: data.method } };
            // If 'Method' is a TEXT or RICH_TEXT property:
            // properties['Method'] = { rich_text: [{ text: { content: data.method } }] };
        }

        // Conditionally add 'Status Code' (assuming Number property)
        if (data.statusCode !== undefined) {
             // Ensure the property name matches your Notion DB, e.g., 'HTTP Status Code'
            properties['Status Code'] = { number: data.statusCode };
        }


        // Create the page in Notion
        await notion.pages.create({
            parent: { database_id: databaseId },
            properties: properties,
        });

        console.log(`Successfully logged event to Notion for URL: ${data.url}`);

    } catch (error: any) {
        console.error("Failed to log scrape event to Notion:", error.body || error.message || error);
    }
}