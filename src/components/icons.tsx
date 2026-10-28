import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 18, ...props }: IconProps, path: React.ReactNode) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {path}
    </svg>
  );
}

export const PlusIcon = (p: IconProps) =>
  base(p, <path d="M12 5v14M5 12h14" />);

export const DocIcon = (p: IconProps) =>
  base(
    p,
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M9 13h6M9 17h4" />
    </>,
  );

export const SearchIcon = (p: IconProps) =>
  base(
    p,
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>,
  );

export const ShareIcon = (p: IconProps) =>
  base(
    p,
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
    </>,
  );

export const TrashIcon = (p: IconProps) =>
  base(
    p,
    <>
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
    </>,
  );

export const PencilIcon = (p: IconProps) =>
  base(
    p,
    <>
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
      <path d="m15 5 4 4" />
    </>,
  );

export const XIcon = (p: IconProps) => base(p, <path d="M18 6 6 18M6 6l12 12" />);

export const CheckIcon = (p: IconProps) => base(p, <path d="M20 6 9 17l-5-5" />);

export const ErrorIcon = (p: IconProps) =>
  base(
    p,
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </>,
  );

export const LogoutIcon = (p: IconProps) =>
  base(
    p,
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </>,
  );

export const UploadIcon = (p: IconProps) =>
  base(
    p,
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m17 8-5-5-5 5M12 3v12" />
    </>,
  );

export const EyeIcon = (p: IconProps) =>
  base(
    p,
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>,
  );

export const TextIcon = (p: IconProps) =>
  base(
    p,
    <>
      <path d="M4 7V5h16v2M12 5v14M9 19h6" />
    </>,
  );
