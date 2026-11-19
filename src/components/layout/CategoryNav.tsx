import { SPORT_CATEGORIES } from '@/constants/categories';
import type { SportCategoryId } from '@/types/common';
import { cn } from '@/utils/cn';

interface CategoryNavProps {
  activeCategory: SportCategoryId;
  onSelect: (category: SportCategoryId) => void;
}

export function CategoryNav({ activeCategory, onSelect }: CategoryNavProps) {
  return (
    <div className="category-bar">
      <div className="container category-list" role="tablist" aria-label="体育项目分类">
        {SPORT_CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            role="tab"
            aria-selected={activeCategory === category.id}
            className={cn(
              'category-pill',
              activeCategory === category.id && 'active',
            )}
            onClick={() => onSelect(category.id)}
          >
            {category.label}
          </button>
        ))}
      </div>
    </div>
  );
}
