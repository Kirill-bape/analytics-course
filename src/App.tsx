import { useEffect } from 'react';
import { useRoute } from './router';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { CoursePage } from './pages/CoursePage';
import { TopicPage } from './pages/TopicPage';
import { PlanPage } from './pages/PlanPage';
import { DevPage } from './pages/DevPage';
import { SettingsPage } from './pages/SettingsPage';
import { ensureDb } from './sql/engine';

export function App() {
  const route = useRoute();

  // База данных загружается сразу при открытии приложения
  useEffect(() => {
    ensureDb().catch(() => undefined);
  }, []);

  // При переходе на другую страницу — прокрутка в начало
  const path = route.join('/');
  useEffect(() => {
    if (route[0] !== 'course' || !route[1]) window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  let page;
  switch (route[0]) {
    case 'course':
      page = <CoursePage anchor={route[1]} />;
      break;
    case 'topic':
      page = <TopicPage moduleId={route[1] ?? ''} topicId={route[2] ?? ''} />;
      break;
    case 'plan':
      page = <PlanPage />;
      break;
    case 'settings':
      page = <SettingsPage />;
      break;
    case 'dev':
      page = <DevPage />;
      break;
    default:
      page = <HomePage />;
  }
  return <Layout route={route}>{page}</Layout>;
}
