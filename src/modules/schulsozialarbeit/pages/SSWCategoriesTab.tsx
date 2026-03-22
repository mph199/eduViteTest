import type { CounselorTopic as Category } from '../../../types';
import api from '../../../services/api';
import { TopicCategoryTab } from '../../../components/TopicCategoryTab';

interface Props {
  categories: Category[];
  showFlash: (msg: string) => void;
  loadData: () => void;
}

const sswApi = { create: api.ssw.createCategory, update: api.ssw.updateCategory };
const sswLabels = { singular: 'Neues Thema', plural: 'Themen', created: 'Kategorie erstellt.', updated: 'Kategorie aktualisiert.' };

export function SSWCategoriesTab({ categories, showFlash, loadData }: Props) {
  return (
    <TopicCategoryTab
      items={categories}
      showFlash={showFlash}
      loadData={loadData}
      api={sswApi}
      labels={sswLabels}
      idPrefix="ssw-cat"
    />
  );
}
