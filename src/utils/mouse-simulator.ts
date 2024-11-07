import { Page } from "puppeteer";
import { delay } from "./utils";

export class MouseSimulator {
    private page: Page;
    private isRunning: boolean = false;
    private lastMouseX: number = 0;
    private lastMouseY: number = 0;
    private currentSpeed: number = 0;
    private currentAngle: number = 0;
    private movementPromise: Promise<void> | null = null;
    private abortController: AbortController | null = null;

    constructor(page: Page) {
        this.page = page;
    }

    async simulateMouseMovement(
        minX: number,
        maxX: number,
        minY: number,
        maxY: number,
        minSpeed: number = 50,
        maxSpeed: number = 500,
        minAngleChange: number = -10,
        maxAngleChange: number = 10
    ): Promise<void> {
        // If already running, stop previous simulation
        if (this.isRunning) {
            await this.stopMouseMovement();
        }

        this.isRunning = true;
        this.abortController = new AbortController();

        this.movementPromise = (async () => {
            try {
                while (this.isRunning) {
                    // Check if we should abort
                    if (this.abortController?.signal.aborted) {
                        break;
                    }

                    const newSpeed = this.getRandomInt(minSpeed, maxSpeed);
                    const newAngleChange = this.getRandomInt(minAngleChange, maxAngleChange);
                    this.currentAngle += newAngleChange;
                    this.currentSpeed = newSpeed;

                    const newX = this.lastMouseX + Math.cos(this.toRadians(this.currentAngle)) * this.currentSpeed;
                    const newY = this.lastMouseY + Math.sin(this.toRadians(this.currentAngle)) * this.currentSpeed;

                    const x = this.clamp(newX, minX, maxX);
                    const y = this.clamp(newY, minY, maxY);

                    // Check if page is still accessible
                    if (this.page.isClosed()) {
                        break;
                    }

                    await this.page.mouse.move(x, y, {
                        steps: this.getRandomInt(5, 20),
                    });

                    this.lastMouseX = x;
                    this.lastMouseY = y;

                    const delayTime = this.getRandomInt(50, 500);
                    await delay(delayTime);
                }
            } catch (error) {
                if (!(error instanceof Error && error.message.includes('Target closed'))) {
                    throw error;
                }
            } finally {
                this.isRunning = false;
                this.abortController = null;
            }
        })();

        return this.movementPromise;
    }

    async stopMouseMovement(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        this.abortController?.abort();

        try {
            // Waiting for the completion of the current cycle of movement
            await this.movementPromise;
            
            // Trying to execute the last mouse movement only if the page is still open
            if (!this.page.isClosed()) {
                await this.page.mouse.move(this.lastMouseX, this.lastMouseY);
            }
        } catch (error) {
            // Ignore errors related to a closed page
            if (!(error instanceof Error && error.message.includes('Target closed'))) {
                throw error;
            }
        } finally {
            this.movementPromise = null;
            this.abortController = null;
        }
    }

    private getRandomInt(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    private toRadians(degrees: number): number {
        return degrees * (Math.PI / 180);
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }
}