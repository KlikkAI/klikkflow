/**
 * Universal Property Renderer Component
 *
 * Implements the PropertyRendererFactory pattern to eliminate
 * 90%+ of property rendering duplication across the codebase.
 *
 * Targets: 25+ property renderer files in jscpd analysis
 */

import { EyeInvisibleOutlined, EyeTwoTone, UploadOutlined } from '@ant-design/icons';
import {
  Checkbox,
  ColorPicker,
  DatePicker,
  Input,
  InputNumber,
  Select,
  Switch,
  Upload,
} from 'antd';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import type { PropertyContext, PropertyRendererConfig } from '../factories/PropertyRendererFactory';
import { cn } from '../utils';

const { TextArea } = Input;
const { Option } = Select;

interface PropertyRendererProps {
  config: PropertyRendererConfig;
  context: PropertyContext;
}

/**
 * Individual Property Renderers
 */
export const TextRenderer: React.FC<PropertyRendererProps> = ({ config, context }) => {
  const { value, error, onChange, onFocus, onBlur, styling, ...props } = useMemo(
    () => context.formData[config.id] ?? config.defaultValue,
    [config, context]
  );

  return (
    <Input
      {...props}
      value={value}
      status={error ? 'error' : undefined}
      className={cn(
        'w-full',
        styling?.size === 'sm' && 'h-8',
        styling?.size === 'lg' && 'h-12',
        styling?.variant === 'outlined' && 'border-2',
        styling?.customClasses
      )}
      onChange={(e) => onChange?.(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
};

export const PasswordRenderer: React.FC<PropertyRendererProps> = ({ config, context }) => {
  const { value, error, onChange, onFocus, onBlur, styling, ...props } = useMemo(
    () => context.formData[config.id] ?? config.defaultValue,
    [config, context]
  );

  return (
    <Input.Password
      {...props}
      value={value}
      status={error ? 'error' : undefined}
      iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
      className={cn(
        'w-full',
        styling?.size === 'sm' && 'h-8',
        styling?.size === 'lg' && 'h-12',
        styling?.customClasses
      )}
      onChange={(e) => onChange?.(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
};

export const EmailRenderer: React.FC<PropertyRendererProps> = ({ config, context }) => {
  const { value, error, onChange, onFocus, onBlur, styling, ...props } = useMemo(
    () => context.formData[config.id] ?? config.defaultValue,
    [config, context]
  );

  return (
    <Input
      {...props}
      type="email"
      value={value}
      status={error ? 'error' : undefined}
      className={cn(
        'w-full',
        styling?.size === 'sm' && 'h-8',
        styling?.size === 'lg' && 'h-12',
        styling?.customClasses
      )}
      onChange={(e) => onChange?.(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
};

export const NumberRenderer: React.FC<PropertyRendererProps> = ({ config, context }) => {
  const { value, error, onChange, onFocus, onBlur, styling, ...props } = useMemo(
    () => context.formData[config.id] ?? config.defaultValue,
    [config, context]
  );

  return (
    <InputNumber
      {...props}
      value={value}
      status={error ? 'error' : undefined}
      className={cn(
        'w-full',
        styling?.size === 'sm' && 'h-8',
        styling?.size === 'lg' && 'h-12',
        styling?.customClasses
      )}
      onChange={(val) => onChange?.(val)}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
};

export const TextareaRenderer: React.FC<PropertyRendererProps> = ({ config, context }) => {
  const { value, error, onChange, onFocus, onBlur, styling, ...props } = useMemo(
    () => context.formData[config.id] ?? config.defaultValue,
    [config, context]
  );

  return (
    <TextArea
      {...props}
      value={value}
      status={error ? 'error' : undefined}
      rows={styling?.size === 'sm' ? 3 : styling?.size === 'lg' ? 8 : 5}
      className={cn('w-full', styling?.customClasses)}
      onChange={(e) => onChange?.(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
};

export const SelectRenderer: React.FC<PropertyRendererProps> = ({ config, context }) => {
  const { value, error, onChange, onFocus, onBlur, styling, options, ...props } = useMemo(
    () => context.formData[config.id] ?? config.defaultValue,
    [config, context]
  );

  return (
    <Select
      {...props}
      value={value}
      status={error ? 'error' : undefined}
      className={cn(
        'w-full',
        styling?.size === 'sm' && 'h-8',
        styling?.size === 'lg' && 'h-12',
        styling?.customClasses
      )}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {options?.map((option: any) => (
        <Option key={option.value} value={option.value} disabled={option.disabled}>
          {option.icon && <span className="mr-2">{option.icon}</span>}
          {option.label}
          {option.description && <div className="text-xs text-gray-400">{option.description}</div>}
        </Option>
      ))}
    </Select>
  );
};

export const MultiSelectRenderer: React.FC<PropertyRendererProps> = ({ config, context }) => {
  const { value, error, onChange, onFocus, onBlur, styling, options, ...props } = useMemo(
    () => context.formData[config.id] ?? config.defaultValue,
    [config, context]
  );

  return (
    <Select
      {...props}
      mode="multiple"
      value={value}
      status={error ? 'error' : undefined}
      className={cn('w-full', styling?.customClasses)}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {options?.map((option: any) => (
        <Option key={option.value} value={option.value} disabled={option.disabled}>
          {option.icon && <span className="mr-2">{option.icon}</span>}
          {option.label}
        </Option>
      ))}
    </Select>
  );
};

export const CheckboxRenderer: React.FC<PropertyRendererProps> = ({ config, context }) => {
  const { value, error, onChange, styling, ...props } = useMemo(
    () => context.formData[config.id] ?? config.defaultValue,
    [config, context]
  );

  return (
    <Checkbox
      {...props}
      checked={value}
      className={cn(styling?.customClasses)}
      onChange={(e) => onChange?.(e.target.checked)}
    >
      {config.label}
    </Checkbox>
  );
};

export const SwitchRenderer: React.FC<PropertyRendererProps> = ({ config, context }) => {
  const { value, error, onChange, styling, ...props } = useMemo(
    () => context.formData[config.id] ?? config.defaultValue,
    [config, context]
  );

  return (
    <div className="flex items-center gap-2">
      <Switch
        {...props}
        checked={value}
        size={styling?.size === 'sm' ? 'small' : 'default'}
        className={cn(styling?.customClasses)}
        onChange={onChange}
      />
      <span>{config.label}</span>
    </div>
  );
};

export const DateRenderer: React.FC<PropertyRendererProps> = ({ config, context }) => {
  const { value, error, onChange, onFocus, onBlur, styling, ...props } = useMemo(
    () => context.formData[config.id] ?? config.defaultValue,
    [config, context]
  );

  return (
    <DatePicker
      {...props}
      value={value}
      status={error ? 'error' : undefined}
      className={cn(
        'w-full',
        styling?.size === 'sm' && 'h-8',
        styling?.size === 'lg' && 'h-12',
        styling?.customClasses
      )}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
};

export const ColorRenderer: React.FC<PropertyRendererProps> = ({ config, context }) => {
  const { value, error, onChange, styling, ...props } = useMemo(
    () => context.formData[config.id] ?? config.defaultValue,
    [config, context]
  );

  return (
    <ColorPicker
      {...props}
      value={value}
      size={styling?.size === 'sm' ? 'small' : styling?.size === 'lg' ? 'large' : 'middle'}
      className={cn(styling?.customClasses)}
      onChange={(color) => onChange?.(color.toHexString())}
    />
  );
};

export const FileRenderer: React.FC<PropertyRendererProps> = ({ config, context }) => {
  const { value, error, onChange, styling, ...props } = useMemo(
    () => context.formData[config.id] ?? config.defaultValue,
    [config, context]
  );

  return (
    <Upload
      {...props}
      fileList={value}
      className={cn(styling?.customClasses)}
      onChange={(info) => onChange?.(info.fileList)}
    >
      <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:border-blue-500">
        <UploadOutlined />
        Upload File
      </button>
    </Upload>
  );
};

export const JsonRenderer: React.FC<PropertyRendererProps> = ({ config, context }) => {
  const { value, error, onChange, onFocus, onBlur, styling, ...props } = useMemo(
    () => context.formData[config.id] ?? config.defaultValue,
    [config, context]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      try {
        const parsed = JSON.parse(e.target.value);
        onChange?.(parsed);
      } catch {
        onChange?.(e.target.value);
      }
    },
    [onChange]
  );

  const displayValue = useMemo(() => {
    if (typeof value === 'string') {
      return value;
    }
    return JSON.stringify(value, null, 2);
  }, [value]);

  return (
    <TextArea
      {...props}
      value={displayValue}
      status={error ? 'error' : undefined}
      rows={styling?.size === 'sm' ? 5 : styling?.size === 'lg' ? 15 : 10}
      className={cn('w-full font-mono text-sm', styling?.customClasses)}
      onChange={handleChange}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
};

/**
 * Property Renderer Component Wrapper
 */
export const PropertyRenderer: React.FC<PropertyRendererProps> = ({ config, context }) => {
  const renderField = useCallback(() => {
    const commonProps = { config, context };

    switch (config.type) {
      case 'text':
      case 'url':
      case 'tel':
        return <TextRenderer {...commonProps} />;
      case 'email':
        return <EmailRenderer {...commonProps} />;
      case 'password':
        return <PasswordRenderer {...commonProps} />;
      case 'number':
      case 'range':
        return <NumberRenderer {...commonProps} />;
      case 'textarea':
      case 'markdown':
      case 'code':
        return <TextareaRenderer {...commonProps} />;
      case 'select':
        return <SelectRenderer {...commonProps} />;
      case 'multiselect':
        return <MultiSelectRenderer {...commonProps} />;
      case 'checkbox':
        return <CheckboxRenderer {...commonProps} />;
      case 'switch':
        return <SwitchRenderer {...commonProps} />;
      case 'date':
      case 'datetime':
      case 'time':
        return <DateRenderer {...commonProps} />;
      case 'color':
        return <ColorRenderer {...commonProps} />;
      case 'file':
        return <FileRenderer {...commonProps} />;
      case 'json':
        return <JsonRenderer {...commonProps} />;
      default:
        return <TextRenderer {...commonProps} />;
    }
  }, [config, context]);

  const error = context.errors[config.id];
  const isTouched = context.touched[config.id];

  return (
    <div
      className={cn(
        'space-y-2',
        config.styling?.fullWidth && 'w-full',
        config.styling?.inline && 'flex items-center gap-4'
      )}
    >
      {!['checkbox', 'switch'].includes(config.type) && (
        <div className="flex items-center gap-1">
          <label
            htmlFor={config.id}
            className={cn(
              'text-sm font-medium text-gray-200',
              config.required && 'after:content-["*"] after:ml-1 after:text-red-500'
            )}
          >
            {config.label}
          </label>
          {config.description && (
            <span className="text-xs text-gray-400">({config.description})</span>
          )}
        </div>
      )}

      <div className="relative">
        {renderField()}
        {isTouched && error && <div className="mt-1 text-xs text-red-600">{error}</div>}
      </div>
    </div>
  );
};

export default PropertyRenderer;
