import { Children, isValidElement, type ReactNode } from 'react';
import { OptionSelectDropdown } from '../OptionEditor';

/** Option children let forms share MXU's task dropdown without duplicating menus. */
export function SelectInput({
  value,
  children,
  onValueChange,
  ...props
}: {
  value: string | number | undefined;
  children: ReactNode;
  onValueChange(value: string): void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}) {
  const options = Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value: string | number; children: ReactNode }>(child)) return [];
    return [
      { value: String(child.props.value), label: Children.toArray(child.props.children).join('') },
    ];
  });
  return (
    <OptionSelectDropdown
      {...props}
      value={String(value ?? '')}
      options={options}
      basePath=""
      onChange={onValueChange}
    />
  );
}
