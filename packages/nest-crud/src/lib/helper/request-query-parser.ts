import { BadRequestException } from '@nestjs/common';
import { IFindManyOptions } from '../interface/crud';
import qs from 'qs';

/**
 * RequestQueryParser transforms HTTP query parameters into structured FindQueryBuilder options.
 */
export class RequestQueryParser {

    /**
     * Parse HTTP query parameters into IFindManyOptions format
     */
    static parse(query: Record<string, any>): IFindManyOptions {
        const options: IFindManyOptions = {};

        // First, try to parse the entire query using qs to handle bracket notation
        const parsedQuery = qs.parse(query, {
            depth: 10,
            parameterLimit: 1000,
            parseArrays: true,
            allowDots: true
        });


        // Handle pagination
        if (parsedQuery.limit !== undefined) {
            options.take = this.parseInteger(parsedQuery.limit);
            delete parsedQuery.limit;
        } else if (parsedQuery.take !== undefined) {
            options.take = this.parseInteger(parsedQuery.take);
        }

        if (parsedQuery.offset !== undefined) {
            options.skip = this.parseInteger(parsedQuery.offset);
            delete parsedQuery.offset;
        } else if (parsedQuery.skip !== undefined) {
            options.skip = this.parseInteger(parsedQuery.skip);
        }

        // Handle soft delete options
        if (parsedQuery.withDeleted !== undefined) {
            options.withDeleted = this.parseBoolean(parsedQuery.withDeleted);
        } else if (parsedQuery.onlyDeleted !== undefined) {
            options.onlyDeleted = this.parseBoolean(parsedQuery.onlyDeleted);
        }

        // Handle JSON-serialized parameters with security validation
        if (parsedQuery.where !== undefined) {
            const whereClause = this.parseJSON(parsedQuery.where);
            options.where = whereClause;
            delete parsedQuery.where;
        }
        if (parsedQuery.relations !== undefined) {
            options.relations = this.parseJSON(parsedQuery.relations);
            delete parsedQuery.relations;
        }
        if (parsedQuery.order !== undefined) {
            options.order = this.parseJSON(parsedQuery.order);
            delete parsedQuery.order;
        }
        if (parsedQuery.select !== undefined) {
            options.select = this.parseJSON(parsedQuery.select);
            delete parsedQuery.select;
        }

        return { ...parsedQuery, ...options };
    }

    /**
     * Parse JSON values from query parameters
     */
    private static parseJSON(value: any): any {
        if (typeof value === 'string') {
            try {
                return this.convertObjectValues(JSON.parse(value));
            } catch (error) {
                throw new BadRequestException(error, 'Invalid JSON value');
            }
        }
        return this.convertObjectValues(value);
    }

    /**
     * Recursively convert object values to appropriate types
     */
    private static convertObjectValues(obj: any): any {
        if (Array.isArray(obj)) {
            return obj.map(item => this.convertObjectValues(item));
        }

        if (typeof obj === 'object' && obj !== null) {
            const converted: any = {};
            for (const [key, value] of Object.entries(obj)) {
                converted[key] = this.convertObjectValues(value);
            }
            return converted;
        }

        // Convert string values to appropriate types
        if (typeof obj === 'string') {
            if (
                obj === 'null' || obj === 'undefined' || obj === 'NaN' ||
                obj === 'NULL' || obj === 'UNDEFINED' || obj === 'NAN'
            ) {
                return null;
            }

            // Handle boolean strings
            if (obj === 'true' || obj === 'TRUE') return true;
            if (obj === 'false' || obj === 'FALSE') return false;

            // Handle numeric strings
            if (/^\d+$/.test(obj)) {
                const num = parseInt(obj, 10);
                return isNaN(num) ? obj : num;
            }

            if (/^\d*\.\d+$/.test(obj)) {
                const num = parseFloat(obj);
                return isNaN(num) ? obj : num;
            }
        }


        return obj;
    }


    private static parseInteger(value: any): number {
        if (typeof value === 'number') return Math.floor(value);
        if (typeof value === 'string') {
            const parsed = parseInt(value, 10);
            return isNaN(parsed) ? 0 : parsed;
        }

        return 0;
    }

    /**
     * Parse boolean values from query parameters
     */
    private static parseBoolean(value: any): boolean {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            return value.toLowerCase() === 'true' || value === '1';
        }
        if (typeof value === 'number') {
            return value === 1;
        }
        return false;
    }
}
