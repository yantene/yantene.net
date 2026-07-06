import { Head } from "@inertiajs/react";
import { useTranslation } from "react-i18next";
import { HeroSection } from "~/frontend/components/hero/hero-section";
import { Footer } from "~/frontend/components/layout/footer";
import { Header } from "~/frontend/components/layout/header";
import { AppLayout } from "~/frontend/layouts/app-layout";

export default function Home(): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <AppLayout>
      <Head title={t("home.heading")}>
        <meta name="description" content={t("home.tagline")} />
      </Head>
      {/* 透過ヘッダを Celestim ヒーローの上に重ねる。ヒーローは pt で頭を空けている。 */}
      <Header variant="transparent" />
      <HeroSection />
      <Footer />
    </AppLayout>
  );
}
