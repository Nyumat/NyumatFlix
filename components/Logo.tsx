import { Aside, MediaQuery } from "@mantine/core";
import NyumatFlixLogo from "../public/logo.png";
import Image from "next/image";

const Logo = () => {
  return (
    <Image
      className="mt-2 scale-75 drop-shadow-2xl shadow-current"
      src={NyumatFlixLogo}
      alt="NyumatFlix"
      width={55}
    
      height={60}
    />
  );
};

export default Logo;
