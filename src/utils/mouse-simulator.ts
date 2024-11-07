import { Page } from "puppeteer";
import { delay } from "./utils";

export class MouseSimulator {
    private page: Page;
    private isRunning: boolean = true;
    private lastMouseX: number = 0;
    private lastMouseY: number = 0;
    private currentSpeed: number = 0;
    private currentAngle: number = 0;

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
        this.isRunning = true;
        while (this.isRunning) {
            
            const newSpeed = this.getRandomInt(minSpeed, maxSpeed);
            const newAngleChange = this.getRandomInt(minAngleChange, maxAngleChange);
            this.currentAngle += newAngleChange;
            this.currentSpeed = newSpeed;

            const newX = this.lastMouseX + Math.cos(this.toRadians(this.currentAngle)) * this.currentSpeed;
            const newY = this.lastMouseY + Math.sin(this.toRadians(this.currentAngle)) * this.currentSpeed;

            // Clamp the new coordinates to the specified range
            const x = this.clamp(newX, minX, maxX);
            const y = this.clamp(newY, minY, maxY);

            await this.page.mouse.move(x, y, {
                steps: this.getRandomInt(5, 20),
            });

            this.lastMouseX = x;
            this.lastMouseY = y;

            const delayTime = this.getRandomInt(50, 500);
            await delay(delayTime);
        }
    }

    async stopMouseMovement(): Promise<void> {
        this.isRunning = false;
        await this.page.mouse.move(this.lastMouseX, this.lastMouseY);
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