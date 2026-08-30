export type MinistryType = 'MINISTRY' | 'DEPARTMENT';

export interface PredefinedMinistry {
    id: string;
    name: string;
    type: MinistryType;
    description: string | null;
    icon: string | null;
}

export const PREDEFINED_MINISTRIES: PredefinedMinistry[] = [
    {
        id: '11111111-1111-4a11-8b11-111111111111',
        name: 'Worship & Music Ministry',
        type: 'MINISTRY',
        description: 'Leads congregational worship and music.',
        icon: 'music',
    },
    {
        id: '22222222-2222-4a22-8b22-222222222222',
        name: "Children's Ministry",
        type: 'MINISTRY',
        description: 'Nurtures faith in children and families.',
        icon: 'baby',
    },
    {
        id: '33333333-3333-4a33-8b33-333333333333',
        name: 'Youth Ministry',
        type: 'MINISTRY',
        description: 'Disciples and connects teenagers and young adults.',
        icon: 'users',
    },
    {
        id: '44444444-4444-4a44-8b44-444444444444',
        name: "Men's Ministry",
        type: 'MINISTRY',
        description: 'Equips and builds up men in faith and leadership.',
        icon: 'shield',
    },
    {
        id: '55555555-5555-4a55-8b55-555555555555',
        name: "Women's Ministry",
        type: 'MINISTRY',
        description: 'Builds community and faith among women.',
        icon: 'heart',
    },
    {
        id: '66666666-6666-4a66-8b66-666666666666',
        name: 'Prayer Ministry',
        type: 'MINISTRY',
        description: 'Intercedes for the church and wider community.',
        icon: 'praying-hands',
    },
    {
        id: '77777777-7777-4a77-8b77-777777777777',
        name: 'Marriage & Family Ministry',
        type: 'MINISTRY',
        description: 'Strengthens marriages and families.',
        icon: 'home',
    },
    {
        id: '88888888-8888-4a88-8b88-888888888888',
        name: 'Outreach & Evangelism',
        type: 'MINISTRY',
        description: 'Shares the gospel and serves the local community.',
        icon: 'megaphone',
    },
    {
        id: '99999999-9999-4a99-8b99-999999999999',
        name: 'Discipleship Ministry',
        type: 'MINISTRY',
        description: 'Grows believers through small groups and mentoring.',
        icon: 'book-open',
    },
    {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: 'Sunday School',
        type: 'MINISTRY',
        description: 'Provides age-appropriate biblical teaching.',
        icon: 'graduation-cap',
    },
    {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        name: 'Ushering Department',
        type: 'DEPARTMENT',
        description: 'Welcomes and seats attendees during services.',
        icon: 'door-open',
    },
    {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        name: 'Media & Communications',
        type: 'DEPARTMENT',
        description: 'Handles audiovisual, livestreaming and communications.',
        icon: 'camera',
    },
    {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        name: 'Finance Department',
        type: 'DEPARTMENT',
        description: 'Manages church finances and giving.',
        icon: 'wallet',
    },
    {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        name: 'Hospitality Department',
        type: 'DEPARTMENT',
        description: 'Hosts guests and coordinates refreshments and events.',
        icon: 'coffee',
    },
    {
        id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        name: 'Information Technology',
        type: 'DEPARTMENT',
        description: "Runs the church's technical systems and tools.",
        icon: 'laptop',
    },
    {
        id: 'a1b2c3d4-e5f6-4a5b-8c9d-e1f2a3b4c5d6',
        name: 'Security & Safety',
        type: 'DEPARTMENT',
        description: 'Keeps members and church facilities safe.',
        icon: 'shield-check',
    },
];