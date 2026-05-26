using System.Collections.Generic;

namespace TiaOpennessWrapper.Services.Export;

public class HwConfigComparisonDetails
{
	public HwConfigComparisonResult Result { get; set; } = HwConfigComparisonResult.ComparisonFailed;

	public List<string> Differences { get; set; } = new List<string>();

	public List<string> AddedModules { get; set; } = new List<string>();

	public List<string> RemovedModules { get; set; } = new List<string>();

	public List<string> ChangedModules { get; set; } = new List<string>();

	public List<string> AddedAddresses { get; set; } = new List<string>();

	public List<string> ChangedAddresses { get; set; } = new List<string>();

	public List<string> ChangedParameters { get; set; } = new List<string>();

	public string? ErrorMessage { get; set; }

	public bool HasDifferences
	{
		get
		{
			if (AddedModules.Count <= 0 && RemovedModules.Count <= 0 && ChangedModules.Count <= 0 && AddedAddresses.Count <= 0 && ChangedAddresses.Count <= 0)
			{
				return ChangedParameters.Count > 0;
			}
			return true;
		}
	}
}
