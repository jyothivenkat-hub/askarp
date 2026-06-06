window.KARPATHY_COMPANION_SOURCES = [
  {
    id: "official-home",
    title: "Andrej Karpathy homepage",
    kind: "Official site",
    year: "2024",
    url: "https://karpathy.ai/",
    tags: ["bio", "teaching", "videos", "ai education", "public work"],
    summary:
      "The public homepage frames Karpathy as an AI researcher and educator, links to his YouTube channel, and separates technical AI videos from general audience AI videos.",
    principles: [
      "Treat the companion as an educational interface over public material, not as a claim to be the real person.",
      "Keep source links visible because the original public work is the authority."
    ],
    patterns: [
      "Route general questions to the general audience LLM videos.",
      "Route implementation questions to Zero to Hero, code projects, and technical writing."
    ],
    codeHint:
      "const answer = retrievePublicSources(question).map(cite).join('\\n');"
  },
  {
    id: "zero-to-hero",
    title: "Neural Networks: Zero to Hero",
    kind: "Course",
    year: "Ongoing",
    url: "https://karpathy.ai/zero-to-hero.html",
    tags: ["course", "backprop", "language models", "gpt", "from scratch", "python"],
    summary:
      "A from-scratch neural network course that starts with backpropagation and builds toward modern language models such as GPT.",
    principles: [
      "Build intuition by implementing the machinery directly before treating frameworks as magic.",
      "Language models are a useful path into deep learning because the ideas transfer to other domains."
    ],
    patterns: [
      "Start with tiny examples, inspect the numbers, then scale the same idea.",
      "Prefer clear Python and visible tensors while learning."
    ],
    codeHint:
      "for parameter in model.parameters(): parameter.data += -learning_rate * parameter.grad"
  },
  {
    id: "micrograd",
    title: "The spelled-out intro to neural networks and backpropagation: building micrograd",
    kind: "YouTube lecture",
    year: "Zero to Hero",
    url: "https://www.youtube.com/watch?v=VMj-3S1tku0",
    tags: ["micrograd", "backprop", "autograd", "derivative", "neural networks"],
    summary:
      "A step-by-step build of a small scalar autograd engine that shows how values, operations, and gradients form a computation graph.",
    principles: [
      "Backprop is bookkeeping over a computation graph: local derivatives compose backward through the graph.",
      "A neural network is just a differentiable expression with many parameters."
    ],
    patterns: [
      "Represent each value with data, gradient, previous nodes, and a backward function.",
      "Topologically sort the graph before running backward passes."
    ],
    codeHint:
      "class Value { constructor(data) { this.data = data; this.grad = 0; this.prev = []; } }"
  },
  {
    id: "makemore-bigram",
    title: "The spelled-out intro to language modeling: building makemore",
    kind: "YouTube lecture",
    year: "Zero to Hero",
    url: "https://www.youtube.com/watch?v=PaCmpygFfXo",
    tags: ["language model", "makemore", "bigram", "sampling", "negative log likelihood"],
    summary:
      "A character-level language model introduction using bigrams, sampling, training, and loss evaluation.",
    principles: [
      "Language modeling predicts the next token from context, then samples from the learned distribution.",
      "Loss gives a concrete measurement of how surprised the model is by the training data."
    ],
    patterns: [
      "Count simple statistics first, then replace counts with a trained neural network.",
      "Separate training, sampling, and evaluation so each mental model stays clear."
    ],
    codeHint:
      "logits = model(context); loss = negativeLogLikelihood(logits, nextToken);"
  },
  {
    id: "gpt-from-scratch",
    title: "Let's build GPT: from scratch, in code, spelled out",
    kind: "YouTube lecture",
    year: "Zero to Hero",
    url: "https://www.youtube.com/watch?v=kCc8FmEb1nY",
    tags: ["gpt", "transformer", "attention", "language model", "pytorch", "chatgpt"],
    summary:
      "A from-scratch implementation of a GPT-style Transformer, connecting autoregressive language modeling with attention blocks and modern LLM behavior.",
    principles: [
      "A GPT predicts the next token repeatedly, using attention to let tokens communicate with earlier context.",
      "The Transformer is easier to understand when built as small blocks: embeddings, attention, MLP, residual stream, normalization, and logits."
    ],
    patterns: [
      "Keep tensor shapes visible and inspect them often.",
      "Mask future tokens so training matches autoregressive generation."
    ],
    codeHint:
      "attention = softmax((q @ k.T) / sqrt(headSize) + causalMask) @ v"
  },
  {
    id: "tokenizer",
    title: "Let's build the GPT Tokenizer",
    kind: "YouTube lecture",
    year: "Zero to Hero",
    url: "https://www.youtube.com/watch?v=zduSFxRajkE",
    tags: ["tokenizer", "bpe", "tokens", "encoding", "decoding", "llm pipeline"],
    summary:
      "A from-scratch walkthrough of tokenization, including byte-pair encoding and the way text becomes token IDs before reaching the neural network.",
    principles: [
      "Tokenization is a separate stage from the neural network, but it strongly shapes model behavior.",
      "Encoding and decoding choices can explain many strange LLM edge cases."
    ],
    patterns: [
      "Train merges on text statistics, then encode strings by applying those merges.",
      "Test round trips: decode(encode(text)) should preserve the input."
    ],
    codeHint:
      "while pairWithBestRank(tokens): tokens = mergeBestPair(tokens)"
  },
  {
    id: "recipe-training",
    title: "A Recipe for Training Neural Networks",
    kind: "Article",
    year: "2019",
    url: "https://karpathy.github.io/2019/04/25/recipe/",
    tags: ["training", "debugging", "neural networks", "overfit", "baseline", "experiments"],
    summary:
      "A practical training checklist: inspect data, establish a simple baseline, overfit a small batch, add complexity gradually, and watch the right diagnostics.",
    principles: [
      "Neural network training is an empirical debugging process, not just launching a big run.",
      "Earn complexity by proving simpler versions work first."
    ],
    patterns: [
      "Visualize inputs and labels before trusting the pipeline.",
      "Overfit one batch as a smoke test for model and optimizer wiring."
    ],
    codeHint:
      "assert canOverfit(tinyBatch), 'debug the data/model/optimizer before scaling'"
  },
  {
    id: "software-2",
    title: "Software 2.0",
    kind: "Article",
    year: "2017",
    url: "https://karpathy.medium.com/software-2-0-a64152b37c35",
    tags: ["software 2.0", "neural networks", "programming", "data", "models"],
    summary:
      "An argument that some software is moving from hand-written instructions toward learned programs represented by neural network weights.",
    principles: [
      "The dataset, loss, architecture, and optimizer become part of the programming interface.",
      "Debugging learned software requires thinking about data and behavior, not only source code."
    ],
    patterns: [
      "Treat data curation as programming work.",
      "Evaluate the model by behavior across many cases, including edge cases."
    ],
    codeHint:
      "program = train(model, data, loss); behavior = evaluate(program, heldOutCases)"
  },
  {
    id: "rnn-effectiveness",
    title: "The Unreasonable Effectiveness of Recurrent Neural Networks",
    kind: "Article",
    year: "2015",
    url: "https://karpathy.github.io/2015/05/21/rnn-effectiveness/",
    tags: ["rnn", "character model", "sequence modeling", "sampling", "text generation"],
    summary:
      "A widely read exploration of character-level recurrent networks and the surprising structure they can learn from sequence data.",
    principles: [
      "Sequence models can learn patterns at multiple scales when trained to predict what comes next.",
      "Sampling reveals both the model's learned structure and its failure modes."
    ],
    patterns: [
      "Train on simple next-character prediction, then inspect generated samples.",
      "Use generated outputs as qualitative diagnostics alongside loss curves."
    ],
    codeHint:
      "hidden = rnn.step(inputChar, hidden); nextChar = sample(outputDistribution)"
  }
];
