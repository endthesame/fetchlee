export async function getCurrentIP(): Promise<string> {
    const response = await fetch('https://api.ipify.org', {
        method: 'GET'
    });

    if (!response.ok) {
        throw new Error(`Unable to fetch current IP. Status: ${response.status}`);
    }

    return response.text();
}

export async function delay(time: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, time));
}
