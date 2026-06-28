from rouge_score import rouge_scorer

scorer = rouge_scorer.RougeScorer(['rouge1', 'rouge2', 'rougeL'], use_stemmer=True)

reference = "artificial intelligence helps machines learn"
generated = "ai helps machines learn"

scores = scorer.score(reference, generated)

print(scores)
