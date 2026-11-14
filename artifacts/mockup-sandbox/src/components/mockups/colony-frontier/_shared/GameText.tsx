import { useEffect, useState } from "react";
import { useGameLanguage } from "./TranslationProvider";

export function GameText({ children }: { children: string }) {
  const { language, translate } = useGameLanguage();
  const [value, setValue] = useState(children);

  useEffect(() => {
    let active = true;
    setValue(children);

    void translate(children).then((result) => {
      if (active) setValue(result);
    });

    return () => {
      active = false;
    };
  }, [children, language, translate]);

  return <>{value}</>;
}

export default GameText;
