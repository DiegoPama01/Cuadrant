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
      url: '/settings/positions',
      icon: 'lucideSettings2',
      items: [
        {
          title: 'Installations',
          url: '/settings/installations',
        },
        {
          title: 'Positions',
          url: '/settings/positions',
        },
        {
          title: 'Zones',
          url: '/settings/zones',
        },
        {
          title: 'Shifts',
          url: '/settings/shifts',
        },
      ],
    },
  ],
};
