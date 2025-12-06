const ENV_DEBUG_VALUES = ['true', '1'];

const isEnvDebugEnabled = () => {
    const envValue = process.env.NEST_CRUD_DEBUG;
    if (!envValue) {
        return false;
    }
    return ENV_DEBUG_VALUES.includes(envValue.trim().toLowerCase());
};

export class QueryDebugger {

    private enabled: boolean;

    constructor(
        private readonly label: string,
        override?: boolean
    ) {
        this.enabled = typeof override === 'boolean' ? override : isEnvDebugEnabled();
    }

    log(message: string, payload?: unknown) {
        if (!this.enabled) {
            return;
        }
        if (payload !== undefined) {
            console.debug(`[NestCrud:${this.label}] ${message}`, payload);
        } else {
            console.debug(`[NestCrud:${this.label}] ${message}`);
        }
    }

    isEnabled(): boolean {
        return this.enabled;
    }

}
