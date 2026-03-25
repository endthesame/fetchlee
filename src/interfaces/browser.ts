export interface BrowserConfig {
    headless?: boolean; // Whether to run the browser in headless mode but prefer to use --headless
    args?: string[]; // Additional command line arguments to pass to the browser instance.
    defaultViewport?: {
        width: number;
        height: number;
    };
    timeout?: number; // Maximum time in milliseconds to wait for the browser to start. Pass 0 to disable the timeout
    executablePath?: string // Path to a browser executable to use instead of the bundled browser
    userDataDir?: string // Path to a user data directory (see the Chromium docs for more info - https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/user_data_dir.md )
}