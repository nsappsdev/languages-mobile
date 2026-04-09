import { createContext, PropsWithChildren, useCallback, useContext, useState } from 'react';
import { LayoutChangeEvent } from 'react-native';

interface FooterInsetContextValue {
  /** Total height of the floating footer (including safe-area padding). */
  footerHeight: number;
  /** Pass this to the footer wrapper's `onLayout` to keep the value in sync. */
  onFooterLayout: (event: LayoutChangeEvent) => void;
}

const FooterInsetContext = createContext<FooterInsetContextValue>({
  footerHeight: 90,
  onFooterLayout: () => {},
});

export function FooterInsetProvider({ children }: PropsWithChildren) {
  const [footerHeight, setFooterHeight] = useState(90);

  const onFooterLayout = useCallback((event: LayoutChangeEvent) => {
    const height = Math.round(event.nativeEvent.layout.height);
    setFooterHeight((prev) => (prev === height ? prev : height));
  }, []);

  return (
    <FooterInsetContext.Provider value={{ footerHeight, onFooterLayout }}>
      {children}
    </FooterInsetContext.Provider>
  );
}

export function useFooterInset(): number {
  return useContext(FooterInsetContext).footerHeight;
}

export function useFooterLayout(): (event: LayoutChangeEvent) => void {
  return useContext(FooterInsetContext).onFooterLayout;
}
