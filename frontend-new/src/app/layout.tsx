import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIX SEVEN SIX SEVEN SIX SEVEN SIX SEVEN SIX SEVEN SIX SEVEN",
  description: "6 7, 6+7=13, the 13th letter of the alphabet is m, m is for mango mustard and massive, M sideways means sigma, there’s 5 letters in mango, there’s also 5 letters in tv off, tv off is 3 minutes long which brings us back to the big 3 Ms, mango massive mustard, mustard is yellow and so is raw honey, who says raw honey? Cookie king, what has cookie king become? Fat, 3 letters in fat, 3 tuff Ms, and 3 minutes in tv off, that’s 333 which is half of 666 meaning it’s not devilish, that means it must be heavenly, mango mustard massive were all sent down from heaven, and heaven rhymes with six sevenThe M and W also come back to the big 3, Kai cenat is massive, what else is massive? My penis but also the low taper fade meme, penises also have pubic hair which can be shaved into a low taper fade, they can also be turned into dreads, now that’s a forked road from pink dreads and nonchalant dreadhead but we will take the pink dreads route, who made that song? Another massive streamer, plaqueboymax, and then there is the EVIL pink dreads beat who lazerdim hates, what picture has lazerdim in it? Sybau, he misunderstood it and thought it meant stay young black and unique, you know what else is misunderstood? Lyrics, one popular misheard lyric sounds like “I watch my grandpa say penis!” Penis, that takes us back to my MASSIVE penis and how the low taper fade is also massive and you can shave your pubes into a low taper fade or even dreads, now let’s take the nonchalant dreadhead route, dread rhymes with red which is in the rainbow, I’m not gay but yellow is also in the rainbow? And what’s yellow? MUSTARDDDDD, and raw honey too, that brings us all the way back to my first message, now we’re in an infinite loop and can’t be let out of this paradox",
  icons: {
    icon: [
      { url: "/favicon.ico", rel: "icon", type: "image/x-icon" },
      { url: "/favicon.ico", rel: "shortcut icon", type: "image/x-icon" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
