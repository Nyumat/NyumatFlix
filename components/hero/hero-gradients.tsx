"use client";

import { motion } from "framer-motion";

export function HeroGradients() {
  return (
    <>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-black via-black/20 to-transparent z-10"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      />
      <motion.div
        className="absolute inset-0 bg-gradient-to-l from-black via-black/20 to-transparent z-10"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      />
      <motion.div
        className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent z-10"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      />
    </>
  );
}
