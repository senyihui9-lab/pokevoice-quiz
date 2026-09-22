import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
    getDatabase,
    ref,
    set,
    onValue
} from
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const quizStartButton = document.getElementById("quizStartButton");
const replayCryButton = document.getElementById("replayCryButton");
const quizCheckButton = document.getElementById("quizCheckButton");
const quizAnswer = document.getElementById("quizAnswer");
const quizAnswerArea = document.getElementById("quizAnswerArea");
const quizMessage = document.getElementById("quizMessage");
const pokemonSuggestions = document.getElementById("pokemonSuggestions");
const quizPokemonImage = document.getElementById("quizPokemonImage");
const quizPage = document.querySelector(".quiz-page");
const generationHintCheckbox = document.getElementById("generationHintCheckbox");
const typeHintCheckbox = document.getElementById("typeHintCheckbox");
const firstLetterHintCheckbox = document.getElementById("firstLetterHintCheckbox");
const generationHint = document.getElementById("generationHint");
const typeHint = document.getElementById("typeHint");
const firstLetterHint = document.getElementById("firstLetterHint");
const firebaseConfig = {
  apiKey: "AIzaSyBMbTPARxGLgZHD3lVaY4NeOaHBVHhPRs4",
  authDomain: "pokevoice-quiz-bf927.firebaseapp.com",
  projectId: "pokevoice-quiz-bf927",
  storageBucket: "pokevoice-quiz-bf927.firebasestorage.app",
  messagingSenderId: "22531666936",
  appId: "1:22531666936:web:67a6e63414d5b15632dc0d",
  databaseURL: "https://pokevoice-quiz-bf927-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let quizPokemon = null;
let quizAnswerName = "";
let currentAudio = null;
let allPokemonNames = [];
let quizAnswered = false;
let quizHints = {
    generation: "",
    type: "",
    firstLetter: ""
};
const db = getDatabase(app);
// Firebase接続テスト
async function testFirebaseConnection() {
    try {
        await set(
            ref(db, "test/message"),
            "Firebase接続成功！"
        );

        console.log("Firebaseへの書き込み成功！");
    } catch (error) {
        console.error("Firebaseへの書き込み失敗:", error);
    }
}

testFirebaseConnection();
quizStartButton.addEventListener("click", startQuiz);
replayCryButton.addEventListener("click", () => {
    if (quizPokemon) {
        playCry(quizPokemon);
    }
});
quizCheckButton.addEventListener("click", () => {
    if (quizAnswered) {
        startQuiz();
        return;
    }

    checkQuizAnswer();
});
quizAnswer.addEventListener("input", updateSuggestions);
quizAnswer.addEventListener("input", updateAnswerButton);
quizAnswer.addEventListener("focus", updateSuggestions);
quizAnswer.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        checkQuizAnswer();
    }
});
generationHintCheckbox.addEventListener("change", updateHints);
typeHintCheckbox.addEventListener("change", updateHints);
firstLetterHintCheckbox.addEventListener("change", updateHints);

loadPokemonNames();

async function loadPokemonNames() {
    try {
        const response = await fetch(
            "https://pokeapi.co/api/v2/pokemon-species?limit=1025"
        );

        if (!response.ok) {
            throw new Error("ポケモン名の一覧を取得できませんでした");
        }

        const speciesList = await response.json();
        const names = [];
        const batchSize = 25;

        for (let index = 0; index < speciesList.results.length; index += batchSize) {
            const batch = speciesList.results.slice(index, index + batchSize);
            const batchNames = await Promise.all(
                batch.map(async species => {
                    try {
                        const speciesResponse = await fetch(species.url);

                        if (!speciesResponse.ok) {
                            return null;
                        }

                        const speciesData = await speciesResponse.json();
                        const japaneseName = speciesData.names.find(
                            name => name.language.name === "ja"
                        );

                        if (!japaneseName) {
                            return null;
                        }

                        const speciesId = species.url.match(/\/([0-9]+)\/$/)[1];
                        return {
                            name: japaneseName.name,
                            imageUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${speciesId}.png`
                        };
                    } catch (error) {
                        console.warn("ポケモン名の取得に失敗しました:", species.name);
                        return null;
                    }
                })
            );

            names.push(...batchNames);
            allPokemonNames = names
                .filter(Boolean)
                .sort((firstPokemon, secondPokemon) =>
                    firstPokemon.name.localeCompare(secondPokemon.name, "ja")
                );
            updateSuggestions();
        }

        allPokemonNames = names
            .filter(Boolean)
            .sort((firstPokemon, secondPokemon) =>
                firstPokemon.name.localeCompare(secondPokemon.name, "ja")
            );
        updateSuggestions();
    } catch (error) {
        console.error(error);
    }
}

function updateSuggestions() {
    const query = quizAnswer.value.trim();
    const normalizedQuery = normalizeKana(query);
    const matchedNames = query
        ? allPokemonNames
            .filter(pokemon => normalizeKana(pokemon.name).startsWith(normalizedQuery))
            .slice(0, 20)
        : [];

    pokemonSuggestions.replaceChildren(
        ...matchedNames.map(pokemon => {
            const option = document.createElement("button");
            option.type = "button";
            option.className = "pokemon-suggestion";
            option.setAttribute("role", "option");
            const image = document.createElement("img");
            image.src = pokemon.imageUrl;
            image.alt = "";
            image.loading = "lazy";

            const nameLabel = document.createElement("span");
            nameLabel.textContent = pokemon.name;
            option.append(image, nameLabel);
            option.addEventListener("click", () => {
                quizAnswer.value = pokemon.name;
                pokemonSuggestions.hidden = true;
                quizAnswer.focus();
            });
            return option;
        })
    );

    pokemonSuggestions.hidden = matchedNames.length === 0;
}

function normalizeKana(text) {
    return text.replace(/[ァ-ヶ]/g, character =>
        String.fromCharCode(character.charCodeAt(0) - 0x60)
    );
}

async function startQuiz() {
    quizStartButton.disabled = true;
    quizCheckButton.hidden = true;
    quizAnswerArea.hidden = true;
    quizAnswer.value = "";
    quizAnswered = false;
    quizAnswer.disabled = false;
    quizCheckButton.disabled = false;
    setResultBackground("");
    updateAnswerButton();
    resetHints();
    showQuestionMark();
    quizMessage.textContent = "ポケモンを選んで鳴き声を再生しています...";

    try {
        const randomId = Math.floor(Math.random() * 1025) + 1;
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${randomId}`);

        if (!response.ok) {
            throw new Error("ポケモン情報を取得できませんでした");
        }

        const data = await response.json();
        const speciesResponse = await fetch(data.species.url);

        if (!speciesResponse.ok) {
            throw new Error("ポケモンの名前を取得できませんでした");
        }

        const speciesData = await speciesResponse.json();
        const japaneseName = speciesData.names.find(
            name => name.language.name === "ja"
        );

        quizPokemon = data;
        quizAnswerName = japaneseName ? japaneseName.name : data.name;
        quizHints = {
            generation: `第${getGeneration(data.id)}世代`,
            type: getJapaneseTypeName(data.types[0].type.name),
            firstLetter: quizAnswerName.charAt(0)
        };
        quizMessage.textContent = "鳴き声を聞いて、ポケモンの名前を入力してください。";
        quizAnswerArea.hidden = false;
        quizStartButton.hidden = true;
        quizCheckButton.hidden = false;
        replayCryButton.disabled = false;
        quizAnswer.focus();
        await playCry(data);
    } catch (error) {
        console.error(error);
        quizMessage.textContent = "クイズの準備に失敗しました。もう一度開始してください。";
        quizStartButton.hidden = false;
        quizCheckButton.hidden = true;
    } finally {
        quizStartButton.disabled = false;
    }
}

function updateAnswerButton() {
    if (quizAnswered) {
        quizCheckButton.textContent = "次の問題へ";
        quizCheckButton.classList.remove("give-up-button");
        quizCheckButton.classList.add("check-answer-button");
        return;
    }

    const hasAnswer = quizAnswer.value.trim().length > 0;
    quizCheckButton.textContent = hasAnswer ? "答え合わせ" : "あきらめる";
    quizCheckButton.classList.toggle("give-up-button", !hasAnswer);
    quizCheckButton.classList.toggle("check-answer-button", hasAnswer);
}

function resetHints() {
    generationHintCheckbox.checked = false;
    typeHintCheckbox.checked = false;
    firstLetterHintCheckbox.checked = false;
    generationHintCheckbox.disabled = false;
    typeHintCheckbox.disabled = true;
    firstLetterHintCheckbox.disabled = true;
    generationHint.hidden = true;
    typeHint.hidden = true;
    firstLetterHint.hidden = true;
}

function updateHints() {
    if (generationHintCheckbox.checked) {
        generationHintCheckbox.disabled = true;
        typeHintCheckbox.disabled = false;
    }

    if (typeHintCheckbox.checked) {
        typeHintCheckbox.disabled = true;
        firstLetterHintCheckbox.disabled = false;
    }

    if (firstLetterHintCheckbox.checked) {
        firstLetterHintCheckbox.disabled = true;
    }

    generationHint.textContent = quizHints.generation;
    typeHint.textContent = quizHints.type;
    firstLetterHint.textContent = quizHints.firstLetter;
    generationHint.hidden = !generationHintCheckbox.checked;
    typeHint.hidden = !typeHintCheckbox.checked;
    firstLetterHint.hidden = !firstLetterHintCheckbox.checked;
}

function getGeneration(pokedexNumber) {
    if (pokedexNumber <= 151) return 1;
    if (pokedexNumber <= 251) return 2;
    if (pokedexNumber <= 386) return 3;
    if (pokedexNumber <= 493) return 4;
    if (pokedexNumber <= 649) return 5;
    if (pokedexNumber <= 721) return 6;
    if (pokedexNumber <= 809) return 7;
    if (pokedexNumber <= 905) return 8;
    return 9;
}

function getJapaneseTypeName(type) {
    const typeNames = {
        normal: "ノーマル",
        fire: "ほのお",
        water: "みず",
        electric: "でんき",
        grass: "くさ",
        ice: "こおり",
        fighting: "かくとう",
        poison: "どく",
        ground: "じめん",
        flying: "ひこう",
        psychic: "エスパー",
        bug: "むし",
        rock: "いわ",
        ghost: "ゴースト",
        dragon: "ドラゴン",
        dark: "あく",
        steel: "はがね",
        fairy: "フェアリー"
    };

    return typeNames[type] || type;
}

function checkQuizAnswer() {
    if (!quizPokemon || quizAnswered) {
        quizMessage.textContent = "先にクイズを開始してください。";
        return;
    }

    const answer = normalizeKana(quizAnswer.value.trim());
    const correctAnswer = normalizeKana(quizAnswerName);

    if (answer === correctAnswer) {
        quizMessage.textContent = `正解！ ${quizAnswerName} です。`;
    } else {
        quizMessage.textContent = `不正解です。正解は ${quizAnswerName} でした。`;
    }

    quizAnswered = true;
    quizAnswer.disabled = true;
    quizCheckButton.disabled = false;
    updateAnswerButton();
    setResultBackground(answer === correctAnswer ? "correct" : "incorrect");
    showPokemonImage(quizPokemon);
}

function setResultBackground(result) {
    quizPage.classList.remove("result-correct", "result-incorrect");
    document.body.classList.remove("result-correct", "result-incorrect");

    if (result) {
        quizPage.classList.add(`result-${result}`);
        document.body.classList.add(`result-${result}`);
    }
}

function showQuestionMark() {
    const questionMark = document.createElement("span");
    questionMark.textContent = "?";
    questionMark.setAttribute("aria-hidden", "true");
    quizPokemonImage.className = "quiz-pokemon-image";
    quizPokemonImage.setAttribute("aria-label", "ポケモンの画像は正解後に表示されます");
    quizPokemonImage.replaceChildren(questionMark);
}

function showPokemonImage(pokemon) {
    const imageUrl = pokemon.sprites.other["official-artwork"].front_default;

    if (!imageUrl) {
        return;
    }

    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = quizAnswerName;
    quizPokemonImage.className = "quiz-pokemon-image has-image";
    quizPokemonImage.setAttribute("aria-label", `${quizAnswerName}の画像`);
    quizPokemonImage.replaceChildren(image);
}

document.addEventListener("click", event => {
    if (!event.target.closest(".answer-input-wrapper")) {
        pokemonSuggestions.hidden = true;
    }
});

async function playCry(pokemon) {
    const latestUrl = pokemon.cries && pokemon.cries.latest;
    const legacyUrl = pokemon.cries && pokemon.cries.legacy;

    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }

    for (const cryUrl of [latestUrl, legacyUrl]) {
        if (!cryUrl) {
            continue;
        }

        const audio = new Audio(cryUrl);
        audio.volume = 1.0;
        audio.preload = "auto";

        try {
            await new Promise((resolve, reject) => {
                audio.addEventListener("canplay", resolve, { once: true });
                audio.addEventListener("error", reject, { once: true });
                audio.load();
            });

            currentAudio = audio;
            await audio.play();
            return;
        } catch (error) {
            console.warn("鳴き声の再生に失敗しました:", error);
        }
    }

    throw new Error("利用可能な鳴き声を再生できませんでした");
}
