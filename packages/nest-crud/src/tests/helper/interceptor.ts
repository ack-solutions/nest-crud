// packages/nest-crud/src/tests/helper/test.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { map } from 'rxjs';


@Injectable()
export class TestInterceptor implements NestInterceptor {

    intercept(context: ExecutionContext, next: CallHandler) {
        const request = context.switchToHttp().getRequest();
        // Modify the request object if needed
        request.headers['x-intercepted'] = 'true';

        return next.handle().pipe(
            map(data => {
                // Modify the response data if needed
                if (Array.isArray(data)) {
                    return data.map(item => ({
                        ...item,
                        intercepted: true,
                    }));
                }
                const updatedData = {
                    ...data,
                    intercepted: true,
                };
                return updatedData;
            }),
        );
    }

}
