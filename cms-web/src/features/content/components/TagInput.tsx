import { Autocomplete, Chip, TextField } from '@mui/material';
import { t } from '../../../shared/i18n/t';

/** Free-text tags (§6.2). Normalised (lower-case, trimmed) by the backend. */
export function TagInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  return (
    <Autocomplete
      multiple
      freeSolo
      options={[]}
      value={value}
      onChange={(_, tags) => onChange(tags.map((x) => x.trim()).filter(Boolean))}
      renderTags={(tags, getTagProps) => tags.map((tag, index) => <Chip {...getTagProps({ index })} key={tag} label={tag} size="small" />)}
      renderInput={(params) => <TextField {...params} label={t('content.tags')} placeholder={t('content.addTag')} />}
    />
  );
}
