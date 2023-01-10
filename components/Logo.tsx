import { Aside, MediaQuery } from "@mantine/core";
import NyumatFlixLogo from "../public/logo.png";
import Image from "next/image";

const Logo = () => {
  return <Image src={NyumatFlixLogo} alt="NyumatFlix" width={55} height={60} />;
};

export default Logo;
