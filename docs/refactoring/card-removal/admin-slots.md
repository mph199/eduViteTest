# AdminSlots — Card-Entfernung

## Befund
`teacher-form-container` als Page-Wrapper (Zeile 127) — gesamte Seite in einer Card.
`AdminPageWrapper` ist bereits der Container.

## Vorher
```tsx
<AdminPageWrapper>
  <div className="teacher-form-container">  ← ENTFERNEN
    <h2>...</h2>
    <table>...</table>
  </div>
</AdminPageWrapper>
```

## Nachher
```tsx
<AdminPageWrapper>
  <div className="content-section">
    <h2>...</h2>
    <table>...</table>
  </div>
</AdminPageWrapper>
```
