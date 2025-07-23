# Community Layout Components

This directory contains layout components that ensure consistent alignment with the CommunityNav component.

## CommunityContentContainer

A reusable container component that matches the CommunityNav alignment structure.

### Usage

```tsx
import CommunityContentContainer from '@/components/layout/CommunityContentContainer';

function MyPage() {
  return (
    <div style={{ backgroundColor: "var(--bg-primary)" }}>
      <CommunityNav />
      <CommunityContentContainer className="p-6">
        {/* Your page content here */}
        <h1>Page Title</h1>
        <div>Content goes here...</div>
      </CommunityContentContainer>
    </div>
  );
}
```

### CSS Utility Classes

You can also use the utility classes directly:

```tsx
function MyPage() {
  return (
    <div style={{ backgroundColor: "var(--bg-primary)" }}>
      <CommunityNav />
      <div className="community-content-wrapper">
        <div className="community-content-container p-6">
          {/* Your page content here */}
        </div>
      </div>
    </div>
  );
}
```

### Structure

The container follows this structure to match CommunityNav:

```
<div className="w-full flex justify-center items-center">  <!-- Wrapper -->
  <div className="w-full md:w-2/3">                        <!-- Container -->
    {children}                                              <!-- Content -->
  </div>
</div>
```

### Responsive Behavior

- **Mobile (< md)**: Full width (`w-full`)
- **Desktop (≥ md)**: 2/3 width (`md:w-2/3`)
- **Alignment**: Centered horizontally with `justify-center`

This ensures perfect alignment with the CommunityNav tabs across all screen sizes.

### Benefits

1. **Consistent Alignment**: All content aligns perfectly with navigation tabs
2. **Responsive**: Matches CommunityNav responsive behavior
3. **Reusable**: Single component for all community pages
4. **Maintainable**: Changes to alignment can be made in one place
5. **Type Safe**: Full TypeScript support

### Migration

To migrate existing pages, replace:

```tsx
// Old pattern
<div className="container mx-auto px-4 py-8">
  {/* content */}
</div>

// New pattern
<CommunityContentContainer className="px-4 py-8">
  {/* content */}
</CommunityContentContainer>
```
