import type { RouteRecordRaw } from 'vue-router';

function Layout() {
  return import('@/layouts/index.vue');
}

const routes: RouteRecordRaw = {
  path: '/app',
  component: Layout,
  redirect: '/app/classify',
  name: 'AppMenu',
  meta: {
    title: 'Agent平台',
    icon: 'tdesign:app',
  },
  children: [
    {
      path: 'classify',
      name: 'AppMenuClassify',
      component: () => import('@/views/app/classify.vue'),
      meta: {
        title: '能力分类',
        icon: 'ph:list-fill',
      },
    },
    {
      path: 'application',
      name: 'Application',
      component: () => import('@/views/app/application.vue'),
      meta: {
        title: 'Agent列表',
        icon: 'clarity:vmw-app-line',
      },
    },
  ],
};

export default routes;
