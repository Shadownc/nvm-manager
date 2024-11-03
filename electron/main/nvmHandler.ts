import { exec } from 'child_process';
import { promisify } from 'util';
import https from 'https';

// Promisify exec for ease of use
const execPromise = promisify(exec);

// Execute nvm command and return the output as a Promise
const executeNvmCommand = (args: string[]): Promise<string> => {
    return new Promise((resolve, reject) => {
        exec(`nvm ${args.join(' ')}`, (error, stdout, stderr) => {
            if (error) {
                reject(stderr);
            } else {
                resolve(stdout);
            }
        });
    });
};

// Install Node.js version
export const installNodeVersion = async (version: string): Promise<{ success: boolean, message: string }> => {
    try {
        await executeNvmCommand(['install', version]);
        return { success: true, message: `Successfully installed version ${version}` };
    } catch (error) {
        return { success: false, message: `Error installing version ${version}: ${getErrorMessage(error)}` };
    }
};

// Uninstall Node.js version
export const uninstallNodeVersion = async (version: string): Promise<{ success: boolean, message: string }> => {
    try {
        await executeNvmCommand(['uninstall', version]);
        return { success: true, message: `Successfully uninstalled version ${version}` };
    } catch (error) {
        return { success: false, message: `Error uninstalling version ${version}: ${getErrorMessage(error)}` };
    }
};

// Switch to a specific Node.js version
export const switchNodeVersion = async (version: string): Promise<{ success: boolean, message: string }> => {
    try {
        await executeNvmCommand(['use', version]);
        return { success: true, message: `Switched to version ${version}` };
    } catch (error) {
        return { success: false, message: `Error switching to version ${version}: ${getErrorMessage(error)}` };
    }
};

// Get installed Node.js versions
export const getInstalledVersions = async (): Promise<{ success: boolean, versions: { version: string, isCurrent: boolean }[] }> => {
    try {
        const output = await executeNvmCommand(['ls']);
        const lines = output.split('\n');
        const versions = lines
            .map(line => line.trim())
            .filter(line => line && /\d+\.\d+\.\d+/.test(line)) // 过滤出包含版本号的行
            .map(line => {
                const isCurrent = line.startsWith('*');
                const version = line.replace('*', '').replace(/\(Currently.*\)/, '').trim(); // 移除 * 和 `(Currently...)`
                return { version, isCurrent };
            });
        return { success: true, versions };
    } catch (error) {
        return { success: false, versions: [] };
    }
};

// Get available Node.js versions from Node.js API or nvm command
export const getAvailableNodeVersions = async (): Promise<{ success: boolean, versions: { version: string, status: string, npmVersion: string }[] }> => {
    try {
        const versionsFromAPI = await fetchAvailableVersionsFromAPI();
        const installedVersions = await getInstalledVersions();

        // Create a map of installed versions for easy lookup
        const installedMap = new Map(installedVersions.versions.map(v => [v.version, v]));

        const availableVersions = versionsFromAPI.map(versionInfo => {
            const cleanVersion = versionInfo.version.replace(/^v/, '');
            const status = installedMap.has(cleanVersion) ? 'Installed' : 'Not Installed';
            return {
                version: cleanVersion,
                status,
                npmVersion: versionInfo.npm || 'unknown',
            };
        });

        return { success: true, versions: availableVersions };
    } catch (error) {
        // Fallback to using nvm command if API fails
        const fallbackVersions = await getAvailableVersionsFromNvm();
        return { success: true, versions: fallbackVersions }; // Assuming fallback always succeeds
    }
};

// Fetch available Node.js versions from the Node.js official API
const fetchAvailableVersionsFromAPI = (): Promise<{ version: string, npm: string }[]> => {
    return new Promise((resolve, reject) => {
        https.get('https://nodejs.org/dist/index.json', (res) => {
            let data = '';
            res.on('data', chunk => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const json: { version: string; npm: string }[] = JSON.parse(data);
                    const versions = json.map((item: { version: string; npm: string }) => ({
                        version: item.version,
                        npm: item.npm,
                    }));
                    resolve(versions);
                } catch (error) {
                    reject(`Error parsing JSON from Node.js API: ${getErrorMessage(error)}`);
                }
            });
        }).on('error', err => {
            reject(`Error fetching versions from Node.js API: ${getErrorMessage(err)}`);
        });
    });
};


// Fallback to using nvm command if API fails
const getAvailableVersionsFromNvm = async (): Promise<{ version: string, status: string, npmVersion: string }[]> => {
    try {
        const output = await executeNvmCommand(['ls-remote']);
        const lines = output.split('\n');
        const versionRegex = /\bv\d+\.\d+\.\d+\b/;
        const availableVersions = lines
            .map(line => line.trim())
            .filter(line => line && versionRegex.test(line))
            .map(line => {
                const version = line.match(versionRegex)?.[0] || '';
                return { version, status: 'Not Installed', npmVersion: 'unknown' };
            });

        return availableVersions;
    } catch (error) {
        throw new Error(`Error fetching available versions with nvm: ${getErrorMessage(error)}`);
    }
};

// Helper function to get error message safely
function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'An unknown error occurred';
}
