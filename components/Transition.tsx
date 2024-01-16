import { HTMLMotionProps, motion } from "framer-motion";
import React, { forwardRef } from "react";

type PageTransitionProps = HTMLMotionProps<"div">;
type PageTransitionRef = React.ForwardedRef<HTMLDivElement>;

function PageTransition(
  { children, ...rest }: PageTransitionProps,
  ref: PageTransitionRef,
) {
  const variants = {
    initial: {
      opacity: 0.7,
    },
    animate: {
      opacity: 1,
    },
    exit: {
      opacity: 0.7,
    },
  };

  return (
    <motion.div
      ref={ref}
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 1 }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export default forwardRef(PageTransition);
