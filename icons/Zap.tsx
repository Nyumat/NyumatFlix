function IconPytorchlightning(
  props: JSX.IntrinsicAttributes & React.SVGProps<SVGSVGElement>,
) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="url(#prefix__a)"
      height="3em"
      width="3em"
      {...props}
    >
      <defs>
        <linearGradient id="prefix__a" x1={0} y1={0} x2={1} y2={0}>
          <stop offset={0} stopColor="#3B48FD" />
          <stop offset={1} stopColor="#8DFAEA" />
        </linearGradient>
      </defs>
      <path
        d="M12 0L1.75 6v12L12 24l10.25-6V6z"
        fill="#000000"
        fillRule="evenodd"
      />
      <path d="M12 0L1.75 6v12L12 24l10.25-6V6zm-1.775 18l1.08-4.657-2.428-2.397L13.79 6l-1.082 4.665 2.414 2.384z" />
    </svg>
  );
}

export default IconPytorchlightning;
