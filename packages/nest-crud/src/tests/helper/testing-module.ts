import { Type, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { User } from './entities/user-test.entity';
import { CrudService } from '../../lib/service/crud-service';
import { CrudOptions } from '../../lib/interface/crud';
import { Crud } from '../../lib/decorator/crud.decorator';
import { Profile } from './entities/profile-test.entity';
import { Post } from './entities/post-test.entity';
import { Comment } from './entities/comment-test.entity';
import { ProfileAddress } from './entities/profile-address-test.entity';
import { Country } from './entities/country-test.entity';

export interface TestModuleOptions {
    controllers?: Type<any>[];
    providers?: any[];
    imports?: any[];
}

const dbConfig = {
    type: 'sqlite',
    database: ':memory:',
    entities: [User, Profile, Post, Comment, ProfileAddress, Country],
    synchronize: true,
    logging: ['error', 'warn'],
} as any


export async function createCrudTestingModule(crudOptions: CrudOptions): Promise<TestingModule> {

    @Crud(crudOptions)
    class UserCrudController {
        constructor(_service: CrudService<User>) { }
    }

    const module: TestingModule = await Test.createTestingModule({
        imports: [
            TypeOrmModule.forRoot(dbConfig),
            TypeOrmModule.forFeature([User, Profile, Post, Comment, ProfileAddress, Country]),
        ],
        controllers: [UserCrudController],
        providers: [
            {
                provide: CrudService,
                useFactory: (dataSource: DataSource) => {
                    return new CrudService<User>(dataSource.getRepository(User))
                },
                inject: [DataSource]
            },
        ],
    }).compile();

    return module;
}


export async function createCrudTestApp(options: CrudOptions) {

    const moduleRef = await createCrudTestingModule(options);
    const app = moduleRef.createNestApplication();

    // Enable validation
    app.useGlobalPipes(new ValidationPipe());

    await app.init();
    return app;
}
