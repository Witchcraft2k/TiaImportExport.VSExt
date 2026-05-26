using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaExportOptions
{
	[JsonProperty("includeComments")]
	public bool IncludeComments { get; set; } = true;

	[JsonProperty("excludeSystemBlocks")]
	public bool ExcludeSystemBlocks { get; set; } = true;

	[JsonProperty("format")]
	public string Format { get; set; } = "xml";

	[JsonProperty("dbExportFormat")]
	public string DbExportFormat { get; set; } = "xml";

	[JsonProperty("overwriteExisting")]
	public bool OverwriteExisting { get; set; } = true;

	[JsonProperty("deleteOrphanedFolders")]
	public bool DeleteOrphanedFolders { get; set; } = true;

	[JsonProperty("generateXlsx")]
	public bool GenerateXlsx { get; set; }
}
