"use client";

import { useState } from "react";

export function Description({ text }: { text: string }) {
  const [more, setMore] = useState(false);
  const long = text.length > 140;
  return (
    <p className="whitespace-pre-line text-[15px]">
      {more || !long ? text : `${text.slice(0, 140).trimEnd()}… `}
      {long && !more && (
        <button className="font-semibold hover:underline" onClick={() => setMore(true)}>
          See more
        </button>
      )}
    </p>
  );
}
