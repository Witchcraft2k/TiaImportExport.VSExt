using System.Collections.Generic;
using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class ExportResult
{
	[JsonProperty("success")]
	public bool Success { get; set; }

	[JsonProperty("filePath")]
	public string? FilePath { get; set; }

	[JsonProperty("error")]
	public string? Error { get; set; }

	[JsonProperty("itemCount")]
	public int ItemCount { get; set; }

	[JsonProperty("successCount")]
	public int SuccessCount { get; set; }

	[JsonProperty("errorCount")]
	public int ErrorCount { get; set; }

	[JsonProperty("warningCount")]
	public int WarningCount { get; set; }

	[JsonProperty("skippedCount")]
	public int SkippedCount { get; set; }

	[JsonProperty("messages")]
	public List<ExportMessage> Messages { get; set; } = new List<ExportMessage>();
}
