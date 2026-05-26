using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using System.Xml;
using Siemens.Engineering;
using Siemens.Engineering.Cax;
using Siemens.Engineering.HW;
using TiaOpennessWrapper.Models;
using TiaOpennessWrapper.Services.HW.Cax;

namespace TiaOpennessWrapper.Services.Export;

public class HwConfigExportToTiaService
{
	public async Task<object> ExportHwConfigFileAsync(ProjectBase? currentProject, string xmlFilePath, HwConfigExportToTiaOptions options)
	{
		return await Task.Run(delegate
		{
			//IL_01ec: Expected O, but got Unknown
			//IL_00aa: Unknown result type (might be due to invalid IL or missing references)
			//IL_00af: Unknown result type (might be due to invalid IL or missing references)
			//IL_00bd: Unknown result type (might be due to invalid IL or missing references)
			List<ExportMessage> list = new List<ExportMessage>();
			try
			{
				if (currentProject == null)
				{
					return new
					{
						success = false,
						error = "No project selected",
						messages = list
					};
				}
				if (!File.Exists(xmlFilePath))
				{
					return new
					{
						success = false,
						error = "File not found: " + xmlFilePath,
						messages = list
					};
				}
				string fileName = Path.GetFileName(xmlFilePath);
				list.Add(ExportMessage.Info(fileName, "HwConfig", "Starting HW Config export to TIA Portal"));
				string text = HwConfigFormat.Normalize(options.Format);
				if (text == "cax" || xmlFilePath.EndsWith(".aml", StringComparison.OrdinalIgnoreCase))
				{
					CaxOperationResult caxOperationResult = new HwConfigCaxService().ImportFile(importOption: HwConfigCaxService.ResolveImportOption(options), project: currentProject, amlFilePath: xmlFilePath, messages: list);
					if (caxOperationResult.Success)
					{
						return new
						{
							success = true,
							method = "CAx",
							fileName = fileName,
							logFile = caxOperationResult.LogPath,
							messages = list
						};
					}
					if (text == "cax")
					{
						return new
						{
							success = false,
							error = (caxOperationResult.Error ?? "CAx import failed"),
							messages = list
						};
					}
				}
				string errorMessage = null;
				if (!XmlExportHelper.IsHwConfigXml(xmlFilePath, out errorMessage))
				{
					string text2 = (string.IsNullOrEmpty(errorMessage) ? "File is not a valid HW Config XML file" : ("File is not a valid HW Config XML file: " + errorMessage));
					list.Add(ExportMessage.Error(fileName, "HwConfig", text2));
					return new
					{
						success = false,
						error = text2,
						messages = list
					};
				}
				object obj = TryImportViaCax(currentProject, xmlFilePath, options, list, fileName);
				if (obj != null)
				{
					return obj;
				}
				object obj2 = TryImportViaAml(currentProject, xmlFilePath, options, list, fileName);
				if (obj2 != null)
				{
					return obj2;
				}
				return ImportFromCustomXml(currentProject, xmlFilePath, options, list, fileName);
			}
			catch (EngineeringException ex)
			{
				string text3 = ErrorHelper.ExtractFullErrorMessage((Exception)ex);
				list.Add(ExportMessage.Error(Path.GetFileName(xmlFilePath), "HwConfig", "TIA Portal error", text3));
				return new
				{
					success = false,
					error = text3,
					messages = list
				};
			}
			catch (Exception ex2)
			{
				string text4 = ErrorHelper.ExtractFullErrorMessage(ex2);
				list.Add(ExportMessage.Error(Path.GetFileName(xmlFilePath), "HwConfig", "Failed to export HW Config", text4));
				return new
				{
					success = false,
					error = text4,
					messages = list
				};
			}
		});
	}

	public async Task<object> ExportHwConfigFolderAsync(ProjectBase? currentProject, string folderPath, HwConfigExportToTiaOptions options)
	{
		return await Task.Run((Func<object>)delegate
		{
			List<ExportMessage> list = new List<ExportMessage>();
			int num = 0;
			int num2 = 0;
			int num3 = 0;
			try
			{
				if (currentProject == null)
				{
					return new
					{
						success = false,
						error = "No project selected",
						messages = list
					};
				}
				if (!Directory.Exists(folderPath))
				{
					return new
					{
						success = false,
						error = "Folder not found: " + folderPath,
						messages = list
					};
				}
				string[] files = Directory.GetFiles(folderPath, "*_HwConfig.xml", SearchOption.AllDirectories);
				string[] files2 = Directory.GetFiles(folderPath, "*.aml", SearchOption.AllDirectories);
				string[] array = files.Concat(files2).ToArray();
				if (array.Length == 0)
				{
					array = (from f in Directory.GetFiles(folderPath, "*.xml", SearchOption.AllDirectories)
						where f.Contains("DeviceConfiguration") || XmlExportHelper.IsHwConfigXml(f, out string _)
						select f).ToArray();
				}
				if (array.Length == 0)
				{
					return new
					{
						success = true,
						itemCount = 0,
						message = "No HW Config files found in the folder",
						messages = list
					};
				}
				list.Add(ExportMessage.Info("Folder", "HwConfig", $"Found {array.Length} HW Config file(s)"));
				string[] array2 = array;
				foreach (string text in array2)
				{
					string fileName = Path.GetFileName(text);
					try
					{
						object result = ExportHwConfigFileAsync(currentProject, text, options).Result;
						Type type = result.GetType();
						PropertyInfo property = type.GetProperty("success");
						PropertyInfo property2 = type.GetProperty("skipped");
						PropertyInfo property3 = type.GetProperty("deviceName");
						PropertyInfo property4 = type.GetProperty("error");
						PropertyInfo property5 = type.GetProperty("messages");
						bool flag = property != null && (bool)(property.GetValue(result) ?? ((object)false));
						bool flag2 = property2 != null && (bool)(property2.GetValue(result) ?? ((object)false));
						_ = property3?.GetValue(result) is string;
						string text2 = (property4?.GetValue(result) as string) ?? "Unknown error";
						List<ExportMessage> list2 = property5?.GetValue(result) as List<ExportMessage>;
						if (list2 != null)
						{
							list.AddRange(list2);
						}
						if (flag)
						{
							if (flag2)
							{
								num3++;
							}
							else
							{
								num++;
							}
						}
						else
						{
							num2++;
							if (list2 == null || list2.Count == 0)
							{
								list.Add(ExportMessage.Error(fileName, "HwConfig", "Failed: " + text2));
							}
						}
					}
					catch (Exception ex)
					{
						num2++;
						list.Add(ExportMessage.Error(fileName, "HwConfig", "Error: " + ex.Message));
					}
				}
				return new
				{
					success = (num2 == 0),
					itemCount = num + num2 + num3,
					successCount = num,
					errorCount = num2,
					skippedCount = num3,
					messages = list
				};
			}
			catch (Exception ex2)
			{
				string text3 = ErrorHelper.ExtractFullErrorMessage(ex2);
				list.Add(ExportMessage.Error("Folder", "HwConfig", "Failed to export folder", text3));
				return new
				{
					success = false,
					error = text3,
					messages = list
				};
			}
		});
	}

	private object? TryImportViaCax(ProjectBase project, string xmlFilePath, HwConfigExportToTiaOptions options, List<ExportMessage> messages, string fileName)
	{
		try
		{
			if (!xmlFilePath.EndsWith(".aml", StringComparison.OrdinalIgnoreCase))
			{
				messages.Add(ExportMessage.Info(fileName, "CAx", "Not an AML file, trying alternative methods"));
				return null;
			}
			CaxProvider service = project.GetService<CaxProvider>();
			if (service == null)
			{
				messages.Add(ExportMessage.Info(fileName, "CAx", "CAx provider not available, trying alternative methods"));
				return null;
			}
			FileInfo fileInfo = new FileInfo(xmlFilePath);
			string fileName2 = Path.Combine(Path.GetDirectoryName(xmlFilePath), "CaxImport.log");
			service.Import(fileInfo, new FileInfo(fileName2), (CaxImportOptions)(options.UpdateExisting ? 0 : 0));
			messages.Add(ExportMessage.Success(fileName, "CAx", "Successfully imported via CAx"));
			return new
			{
				success = true,
				method = "CAx",
				fileName = fileName,
				messages = messages
			};
		}
		catch (Exception ex)
		{
			messages.Add(ExportMessage.Warning(fileName, "CAx", "CAx import failed: " + ex.Message));
			return null;
		}
	}

	private object? TryImportViaAml(ProjectBase project, string xmlFilePath, HwConfigExportToTiaOptions options, List<ExportMessage> messages, string fileName)
	{
		try
		{
			if (xmlFilePath.EndsWith(".aml", StringComparison.OrdinalIgnoreCase))
			{
				CaxProvider service = project.GetService<CaxProvider>();
				if (service != null)
				{
					FileInfo fileInfo = new FileInfo(xmlFilePath);
					string fileName2 = Path.Combine(Path.GetDirectoryName(xmlFilePath), "AmlImport.log");
					service.Import(fileInfo, new FileInfo(fileName2), (CaxImportOptions)0);
					messages.Add(ExportMessage.Success(fileName, "AML", "Successfully imported AML file"));
					return new
					{
						success = true,
						method = "AML",
						fileName = fileName,
						messages = messages
					};
				}
			}
			return null;
		}
		catch (Exception ex)
		{
			messages.Add(ExportMessage.Warning(fileName, "AML", "AML import failed: " + ex.Message));
			return null;
		}
	}

	private object ImportFromCustomXml(ProjectBase project, string xmlFilePath, HwConfigExportToTiaOptions options, List<ExportMessage> messages, string fileName)
	{
		try
		{
			XmlDocument xmlDocument = new XmlDocument();
			xmlDocument.Load(xmlFilePath);
			XmlElement documentElement = xmlDocument.DocumentElement;
			if (documentElement == null)
			{
				return new
				{
					success = false,
					error = "Invalid XML structure",
					messages = messages
				};
			}
			XmlNode xmlNode = XmlExportHelper.ParseDeviceNode(xmlDocument, documentElement);
			if (xmlNode == null)
			{
				messages.Add(ExportMessage.Error(fileName, "Parse", "No Device element found in XML"));
				return new
				{
					success = false,
					error = "No Device element found in XML",
					messages = messages
				};
			}
			ModuleExportHelper moduleHelper = new ModuleExportHelper(messages);
			NetworkExportHelper networkHelper = new NetworkExportHelper(messages);
			DeviceExportHelper deviceExportHelper = new DeviceExportHelper(messages);
			string text = xmlNode.Attributes?["Name"]?.Value;
			string fullName = xmlNode.Attributes?["FullName"]?.Value;
			string text2 = xmlNode.Attributes?["TypeIdentifier"]?.Value;
			string text3 = deviceExportHelper.ExtractOrderNumberFromDeviceNode(xmlNode);
			string text4 = deviceExportHelper.ExtractFirmwareVersionFromDeviceNode(xmlNode);
			if (string.IsNullOrEmpty(text))
			{
				messages.Add(ExportMessage.Error(fileName, "Parse", "Device name not found in XML"));
				return new
				{
					success = false,
					error = "Device name not found in XML",
					messages = messages
				};
			}
			messages.Add(ExportMessage.Info(fileName, "Parse", "Parsed device: " + text + " (" + text2 + ")"));
			if (!string.IsNullOrEmpty(text3))
			{
				messages.Add(ExportMessage.Info(fileName, "Parse", "OrderNumber: " + text3 + ", FW: " + text4));
			}
			Device val = deviceExportHelper.FindDeviceByName(project, text, fullName);
			if (val != null)
			{
				if (options.UpdateExisting)
				{
					if (options.SkipIfIdentical)
					{
						messages.Add(ExportMessage.Info(text, "Compare", "Starting comparison..."));
						HwConfigComparisonDetails hwConfigComparisonDetails = HwConfigComparisonService.CompareDeviceWithXml(project, val, xmlFilePath, messages);
						messages.Add(ExportMessage.Info(text, "Compare", $"Comparison result: {hwConfigComparisonDetails.Result}"));
						if (hwConfigComparisonDetails.Result == HwConfigComparisonResult.Same)
						{
							messages.Add(ExportMessage.Info(text, "Compare", "Device configuration is identical - no update needed"));
							return new
							{
								success = true,
								skipped = true,
								method = "Compare",
								deviceName = text,
								message = "Configuration identical - skipped",
								messages = messages
							};
						}
						if (hwConfigComparisonDetails.Result == HwConfigComparisonResult.Different)
						{
							if (options.ShowComparisonDetails && hwConfigComparisonDetails.HasDifferences)
							{
								foreach (string addedModule in hwConfigComparisonDetails.AddedModules)
								{
									messages.Add(ExportMessage.Info(text, "Diff", "+ Module: " + addedModule));
								}
								foreach (string removedModule in hwConfigComparisonDetails.RemovedModules)
								{
									messages.Add(ExportMessage.Warning(text, "Diff", "- Module: " + removedModule));
								}
								foreach (string changedModule in hwConfigComparisonDetails.ChangedModules)
								{
									messages.Add(ExportMessage.Info(text, "Diff", "~ Module: " + changedModule));
								}
								foreach (string changedAddress in hwConfigComparisonDetails.ChangedAddresses)
								{
									messages.Add(ExportMessage.Info(text, "Diff", "~ Address: " + changedAddress));
								}
							}
							messages.Add(ExportMessage.Info(text, "Update", $"Found {hwConfigComparisonDetails.Differences.Count} differences - updating configuration"));
						}
					}
					if (deviceExportHelper.UpdateDeviceConfiguration(project, val, xmlNode, options, moduleHelper, networkHelper))
					{
						messages.Add(ExportMessage.Success(text, "Update", "Device configuration updated"));
						return new
						{
							success = true,
							method = "Update",
							deviceName = text,
							messages = messages
						};
					}
				}
				else if (!options.OverwriteExisting)
				{
					messages.Add(ExportMessage.Warning(text, "Skip", "Device already exists and overwrite is disabled"));
					return new
					{
						success = true,
						skipped = true,
						message = "Device already exists",
						messages = messages
					};
				}
			}
			else
			{
				string text5 = null;
				if (text3 != null && text3.Length > 0 && !text3.Contains("*"))
				{
					text5 = "OrderNumber:" + text3;
					if (!string.IsNullOrEmpty(text4))
					{
						text5 = text5 + "/" + text4;
					}
				}
				else if (text2 != null && text2.Length > 0)
				{
					if (text2.StartsWith("OrderNumber:") && !text2.Contains("*"))
					{
						text5 = text2;
					}
					else if (text2.StartsWith("GSD:"))
					{
						text5 = text2;
					}
					else if (text3 != null && text3.Contains("*"))
					{
						messages.Add(ExportMessage.Warning(text, "Create", "OrderNumber '" + text3 + "' contains placeholder (*) - device cannot be auto-created. This is typically an IO System placeholder. Please create the device manually in TIA Portal."));
					}
				}
				if (!string.IsNullOrEmpty(text5))
				{
					if (deviceExportHelper.CreateNewDevice(project, text, text5, xmlNode, moduleHelper, networkHelper))
					{
						messages.Add(ExportMessage.Success(text, "Create", "New device created"));
						return new
						{
							success = true,
							method = "Create",
							deviceName = text,
							messages = messages
						};
					}
				}
				else
				{
					messages.Add(ExportMessage.Error(text, "Create", "Cannot create device without OrderNumber or valid TypeIdentifier"));
				}
			}
			messages.Add(ExportMessage.Info(fileName, "HwConfig", "HW Config processed - manual verification recommended"));
			return new
			{
				success = true,
				method = "CustomXml",
				deviceName = text,
				messages = messages,
				warning = "Device configuration may require manual verification in TIA Portal"
			};
		}
		catch (Exception ex)
		{
			string text6 = ErrorHelper.ExtractFullErrorMessage(ex);
			messages.Add(ExportMessage.Error(fileName, "Parse", "Failed to parse custom XML", text6));
			return new
			{
				success = false,
				error = text6,
				messages = messages
			};
		}
	}
}

