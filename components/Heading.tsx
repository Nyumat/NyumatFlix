import Logo from "./Logo";

const Heading = () => {
  return (
    <header className="flex items-center justify-center flex-row gap-0">
      <Logo />
      <div className="flex flex-row align-center items-center justify-center w-screen">
        <h1
          className="whitespace-nowrap text-2xl font-bold font-sans leading-none tracking-tight sm:text-3xl md:text-4xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-teal-200 translate-x-[-4.5rem]
        "
        >
          NyumatFlix{" "}
          <span className="text-2xl sm:text-3xl md:text-4xl pb-2 px-2 text-indigo-400"></span>
        </h1>
      </div>
    </header>
  );
};

export default Heading;
