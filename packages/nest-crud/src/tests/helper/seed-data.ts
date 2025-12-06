import { Repository } from "typeorm";
import { DataSource } from "typeorm";

export const defaultTestData: any[] = [
    {
        name: 'John Doe',
        email: 'john@example.com',
        status: 'active',
        profile: {
            age: 25,
            verified: true,
            bio: 'Software Engineer',
            addresses: [
                {
                    city: 'New York',
                    state: 'New York',
                    country: { name: 'USA' }
                },
                {
                    city: 'Los Angeles',
                    street: '123 Main St',
                    street2: 'Apt 4B',
                    state: 'California',
                    postalCode: '90001',
                    country: { name: 'USA' }
                },
            ],
        },
        posts: [
            {
                title: 'First Post',
                content: 'Content 1',
                status: 'published',
                likes: 10,
                tags: ['tech', 'news'],
                comments: [
                    {
                        content: 'Great post!',
                        likes: 10,
                    },
                ],
            },
            {
                title: 'Second Post',
                content: 'Content 2',
                status: 'draft',
                likes: 5,
                tags: ['personal'],
            },
        ],
    },
    {
        name: 'Jane Smith',
        email: 'jane@example.com',
        status: 'inactive',
        profile: {
            age: 30,
            verified: false,
            bio: 'Software Engineer',
            addresses: [
                {
                    city: 'Rajkot',
                    street: '123 Main St',
                    street2: 'Apt 4B',
                    state: 'Gujarat',
                    postalCode: '360001',
                    country: { name: 'India' }
                },
                {
                    city: 'Mumbai',
                    street: '134, 1st Floor',
                    street2: 'Near ABC',
                    state: 'Maharashtra',
                    postalCode: '400001',
                    country: { name: 'India' }
                },
            ],
        },
        posts: [
            {
                title: 'Hello World',
                content: 'Content 3',
                status: 'published',
                likes: 20,
                tags: ['tech'],
                comments: [
                    {
                        content: 'Great post!',
                        likes: 10,
                    },
                    {
                        content: 'Nice post!',
                        likes: 5,
                    },
                ],
            },
        ],
    },
];



/**
 * Seeds test data with relations using proper entity creation
 * to avoid update issues in tests
 */
export async function seedTestData<T>(
    dataSource: DataSource,
    userRepository: Repository<T>,
    testData: any[] = defaultTestData
): Promise<void> {
    // Clear all data first
    await userRepository.clear();

    // Create test data with relations using proper entity creation
    for (const userData of testData) {
        // Create the user first without relations
        const { profile, posts, ...userOnly } = userData;
        const user = userRepository.create(userOnly);
        const savedUser = await userRepository.save(user);

        // If there's profile data, create the profile
        if (profile) {
            const profileRepository = dataSource.getRepository('Profile');
            const { addresses, ...profileOnly } = profile;
            const profileEntity = profileRepository.create({
                ...profileOnly,
                user: savedUser
            });
            const savedProfile = await profileRepository.save(profileEntity);

            // If there are addresses, create them
            if (addresses && addresses.length > 0) {
                const addressRepository = dataSource.getRepository('ProfileAddress');
                const countryRepository = dataSource.getRepository('Country');

                for (const addressData of addresses) {
                    const { country, ...addressOnly } = addressData;

                    // Create or find country
                    let countryEntity;
                    if (country) {
                        countryEntity = await countryRepository.findOne({ where: { name: country.name } });
                        if (!countryEntity) {
                            countryEntity = countryRepository.create(country);
                            countryEntity = await countryRepository.save(countryEntity);
                        }
                    }

                    // Create address
                    const address = addressRepository.create({
                        ...addressOnly,
                        profile: savedProfile,
                        country: countryEntity
                    });
                    await addressRepository.save(address);
                }
            }
        }

        // If there are posts, create them
        if (posts && posts.length > 0) {
            const postRepository = dataSource.getRepository('Post');
            const commentRepository = dataSource.getRepository('Comment');

            for (const postData of posts) {
                const { comments, ...postOnly } = postData;
                const post = postRepository.create({
                    ...postOnly,
                    user: savedUser
                });
                const savedPost = await postRepository.save(post);

                // If there are comments, create them
                if (comments && comments.length > 0) {
                    for (const commentData of comments) {
                        const comment = commentRepository.create({
                            ...commentData,
                            post: savedPost
                        });
                        await commentRepository.save(comment);
                    }
                }
            }
        }
    }
}
