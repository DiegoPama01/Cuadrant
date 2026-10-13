export const data = {
  user: {
    name: 'spartan',
    email: 'hello@spartan.com',
    avatar: '/assets/avatar.png',
  },
  navMain: [
    {
      title: 'Management',
      url: '/planning',
      icon: 'lucideSquareTerminal',
      isActive: true,
      items: [
        {
          title: 'Planning',
          url: '/planning',
        },
        {
          title: 'Employees',
          url: '/employees',
        },
      ],
    },
    {
      title: 'Settings',
       url: '/settings/job-roles',
      icon: 'lucideSettings2',
      items: [
        {
          title: 'Installations',
          url: '/settings/installations',
        },
        {
           title: 'Job roles',
           url: '/settings/job-roles',
        },
        {
           title: 'Work areas',
           url: '/settings/work-areas',
        },
        {
           title: 'Shift templates',
           url: '/settings/shift-templates',
        },
      ],
    },
  ],
};
