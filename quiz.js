const quizStartButton = document.getElementById("quizStartButton");
const replayCryButton = document.getElementById("replayCryButton");
const quizCheckButton = document.getElementById("quizCheckButton");
const quizAnswer = document.getElementById("quizAnswer");
const quizAnswerArea = document.getElementById("quizAnswerArea");
const quizMessage = document.getElementById("quizMessage");
const pokemonSuggestions = document.getElementById("pokemonSuggestions");
const quizPokemonImage = document.getElementById("quizPokemonImage");
const generationHintCheckbox = document.getElementById("generationHintCheckbox");
const typeHintCheckbox = document.getElementById("typeHintCheckbox");
const firstLetterHintCheckbox = document.getElementById("firstLetterHintCheckbox");
const generationHint = document.getElementById("generationHint");
const typeHint = document.getElementById("typeHint");
const firstLetterHint = document.getElementById("firstLetterHint");

let quizPokemon = null;
let quizAnswerName = "";
let currentAudio = null;
let allPokemonNames = [];
let quizHints = {
    generation: "",
    type: "",
    firstLetter: ""
};

quizStartButton.addEventListener("click", startQuiz);
replayCryButton.addEventListener("click", () => {
    if (quizPokemon) {
        playCry(quizPokemon);
    }
});
quizCheckButton.addEventListener("click", checkQuizAnswer);
quizAnswer.addEventListener("input", updateSuggestions);
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

                        return japaneseName ? japaneseName.name : null;
                    } catch (error) {
                        console.warn("ポケモン名の取得に失敗しました:", species.name);
                        return null;
                    }
                })
            );

            names.push(...batchNames);
            allPokemonNames = names
                .filter(Boolean)
                .sort((firstName, secondName) => firstName.localeCompare(secondName, "ja"));
            updateSuggestions();
        }

        allPokemonNames = names
            .filter(Boolean)
            .sort((firstName, secondName) => firstName.localeCompare(secondName, "ja"));
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
            .filter(name => normalizeKana(name).startsWith(normalizedQuery))
            .slice(0, 20)
        : [];

    pokemonSuggestions.replaceChildren(
        ...matchedNames.map(name => {
            const option = document.createElement("button");
            option.type = "button";
            option.className = "pokemon-suggestion";
            option.setAttribute("role", "option");
            option.textContent = name;
            option.addEventListener("click", () => {
                quizAnswer.value = name;
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
    quizAnswerArea.hidden = true;
    quizAnswer.value = "";
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
        replayCryButton.disabled = false;
        quizAnswer.focus();
        await playCry(data);
    } catch (error) {
        console.error(error);
        quizMessage.textContent = "クイズの準備に失敗しました。もう一度開始してください。";
    } finally {
        quizStartButton.disabled = false;
    }
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
    if (!quizPokemon) {
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

    showPokemonImage(quizPokemon);
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
