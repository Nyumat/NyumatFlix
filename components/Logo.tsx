import Image from "next/image";
import { useRouter } from "next/router";
import NyumatFlixLogo from "../public/logo.png";

const Logo = () => {
  const router = useRouter();
  return (
    <Image
      className="mt-2 scale-75 drop-shadow-2xl shadow-current cursor-pointer hover:scale-105 transition duration-200 ease-in-out"
      src={NyumatFlixLogo}
      style={{ width: "auto", height: "auto" }}
      priority
      alt="NyumatFlix"
      width={55}
      height={60}
      onClick={() => router.push("/")}
    />
  );
};

export default Logo;
