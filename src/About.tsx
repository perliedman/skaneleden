import { useState } from "react";
import "./App.css";

export default function About({ onClose }: { onClose: () => void }) {
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      <div>
        <img src="/favicon.png" className="w-8" />
      </div>
      <div className="flex-grow justify-self-start max-w-xl mx-auto">
        <div className="text-lg tracking-wider">Skåneleden</div>
        {showMore ? (
          <>
            <div className="text-sm text-justify">
              <p>
                Skåneleden är en vandringsled genom Skåne som är uppdelad i sex
                delleder och består sammanlagt av över 130 mil genom 32
                kommuner, varav 3 ligger i annat län. (Källa{" "}
                <a
                  href="https://sv.wikipedia.org/wiki/Sk%C3%A5neleden"
                  target="_blank"
                >
                  Wikipedia
                </a>
                )
              </p>
              <p>
                Detta är webbplats är en interaktiv karta över Skåneleden, där
                du kan få mer information om etapperna och planera din vandring.
                Mer information om Skåneleden finns på{" "}
                <a href="https://skaneleden.se" target="_blank">
                  Skåneledens officiella webbplats
                </a>
                .
              </p>
              <p>
                För att se <strong>mer information om en etapp</strong>, klicka
                på den i kartan.
              </p>
              <p>
                För att <strong>planera en vandring</strong>, peka på start-
                eller slutpunkt och håll intryckt en stund (om du är på mobil)
                eller högerklicka (om du sitter vid en dator). Du kan dra i
                markörerna för att ändra din tur.
              </p>
              <p>
                Källdata om Skåneleden från{" "}
                <a href="https://openstreetmap.org/" target="_blank">
                  OpenStreetMap
                </a>
                , bakgrundskartan från{" "}
                <a href="https://www.lantmateriet.se/" target="_blank">
                  Lantmäteriet
                </a>
                .
              </p>
              <p>
                Webbplatsen är skapad av{" "}
                <a href="https://github.com/perliedman/" target="_blank">
                  Per Liedman
                </a>{" "}
                och är{" "}
                <a
                  href="https://github.com/perliedman/skaneleden"
                  target="_blank"
                >
                  öppen källkod
                </a>
                .
              </p>
            </div>
            <button
              onClick={() => setShowMore(false)}
              className="text-blue-600 text-sm hover:underline"
            >
              Ok!
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowMore(true)}
            className="text-blue-600 text-sm hover:underline"
          >
            Vad är detta?
          </button>
        )}
      </div>
      <button onClick={onClose} className="text-2xl">
        ×
      </button>
    </>
  );
}
